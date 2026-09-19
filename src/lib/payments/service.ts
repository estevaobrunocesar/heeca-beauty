import "server-only";
import { db } from "@/lib/db";
import { getPixProvider } from "./index";
// Dependência circular com appointments/service é segura: só funções, nada avaliado no carregamento.
import { transition } from "@/lib/appointments/service";

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function paymentPageUrl(confirmationToken: string) {
  return `${appUrl()}/pagar/${confirmationToken}`;
}

/**
 * Gera a cobrança Pix do sinal para um agendamento recém-criado (status AWAITING_PAYMENT).
 * Lança se o provedor falhar — o chamador decide desfazer o agendamento.
 */
export async function createDepositCharge(appointmentId: string, amountCents: number, expiresAt: Date) {
  const appt = await db.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { tenant: true, client: true },
  });
  const provider = getPixProvider(appt.tenant);
  const charge = await provider.createCharge({
    amountCents,
    description: `Sinal · ${appt.serviceName} · ${appt.tenant.businessName}`,
    externalReference: appt.id,
    expiresAt,
    payer: { name: appt.client.name, email: appt.client.email, phone: appt.client.phone },
    notificationUrl: provider.name === "mercadopago" ? `${appUrl()}/api/webhooks/mercadopago` : undefined,
  });
  return db.payment.create({
    data: {
      tenantId: appt.tenantId,
      appointmentId: appt.id,
      provider: provider.name,
      providerPaymentId: charge.providerPaymentId,
      amountCents,
      pixCopyPaste: charge.copyPaste,
      pixQrCodeBase64: charge.qrCodeBase64,
      expiresAt: charge.expiresAt,
    },
  });
}

/**
 * Marca o pagamento como pago e confirma o agendamento (idempotente: chamadas
 * repetidas do webhook/polling não geram efeitos duplicados).
 */
export async function markPaymentPaid(paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { appointment: true } });
  if (!payment) return null;
  if (payment.status === "PAID") return payment;

  const updated = await db.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date() } });
  if (payment.appointment.status === "AWAITING_PAYMENT") {
    await transition({ appointmentId: payment.appointmentId, actor: "SYSTEM", to: "CONFIRMED" });
  }
  return updated;
}

/** Reconsulta o provedor e sincroniza o status local (webhook e polling usam isto). */
export async function syncPaymentStatus(paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { tenant: true } });
  if (!payment || !payment.providerPaymentId) return null;
  if (payment.status !== "PENDING") return payment;

  const remote = await getPixProvider(payment.tenant).getStatus(payment.providerPaymentId);
  if (remote === "paid") return markPaymentPaid(payment.id);
  if (remote === "expired" || remote === "failed" || remote === "cancelled") {
    return db.payment.update({ where: { id: payment.id }, data: { status: remote === "failed" ? "FAILED" : remote === "cancelled" ? "CANCELLED" : "EXPIRED" } });
  }
  return payment;
}

/** Estorna o sinal (quando pago). Falhas ficam registradas em `error`, sem lançar. */
export async function refundDeposit(appointmentId: string) {
  const payment = await db.payment.findUnique({ where: { appointmentId }, include: { tenant: true } });
  if (!payment || payment.status !== "PAID" || !payment.providerPaymentId) return null;
  try {
    await getPixProvider(payment.tenant).refund(payment.providerPaymentId, payment.amountCents);
    return await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[pix] falha ao estornar", payment.id, error);
    return db.payment.update({ where: { id: payment.id }, data: { error: `Estorno falhou: ${error}` } });
  }
}

/** Cobrança não paga cujo agendamento foi cancelado/expirou. */
export async function expireDeposit(appointmentId: string, status: "EXPIRED" | "CANCELLED" = "EXPIRED") {
  await db.payment.updateMany({ where: { appointmentId, status: "PENDING" }, data: { status } });
}

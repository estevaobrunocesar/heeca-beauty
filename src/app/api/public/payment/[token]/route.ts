import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncPaymentStatus } from "@/lib/payments/service";

/**
 * GET /api/public/payment/[token] — status do sinal para a página de pagamento (polling).
 * O token é o `confirmationToken` do agendamento (só quem recebeu o link conhece).
 */
export async function GET(_req: Request, { params }: RouteContext<"/api/public/payment/[token]">) {
  const { token } = await params;
  const appt = await db.appointment.findUnique({
    where: { confirmationToken: token },
    select: { id: true, status: true, payment: { select: { id: true, status: true, expiresAt: true } } },
  });
  if (!appt || !appt.payment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Enquanto pendente, reconsulta o provedor (cobre o caso de webhook atrasado/perdido).
  let payment = appt.payment;
  if (payment.status === "PENDING") {
    const synced = await syncPaymentStatus(payment.id).catch(() => null);
    if (synced) payment = { id: synced.id, status: synced.status, expiresAt: synced.expiresAt };
  }
  const fresh = await db.appointment.findUnique({ where: { id: appt.id }, select: { status: true } });
  return NextResponse.json(
    { paymentStatus: payment.status, appointmentStatus: fresh?.status ?? appt.status, expiresAt: payment.expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

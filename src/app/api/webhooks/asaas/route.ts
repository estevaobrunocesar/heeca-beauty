import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncPaymentStatus } from "@/lib/payments/service";
import { paymentIdFromWebhook, verifyWebhookToken, type AsaasWebhookBody } from "@/lib/payments/asaas-rules";

/**
 * Webhook do Asaas (Configurações → Integrações → Webhooks, evento de cobrança). Cada estabelecimento cadastra esta URL
 * na PRÓPRIA conta Asaas, com o token mostrado em Configurações → Pagamentos (header `asaas-access-token`).
 * Nunca confiamos no payload: só pegamos o id da cobrança e reconsultamos a API.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as AsaasWebhookBody | null;
  const providerPaymentId = paymentIdFromWebhook(body);
  // Evento que não interessa (ou corpo ilegível): responde 200 para o Asaas não pausar a fila de notificações.
  if (!providerPaymentId) return NextResponse.json({ ok: true });

  const payment = await db.payment.findUnique({ where: { providerPaymentId }, select: { id: true, provider: true, tenant: { select: { pixWebhookToken: true } } } });
  if (!payment || payment.provider !== "asaas") return NextResponse.json({ ok: true }); // cobrança de outro sistema na mesma conta

  if (!verifyWebhookToken(req.headers.get("asaas-access-token"), payment.tenant.pixWebhookToken)) {
    console.warn("[asaas] webhook rejeitado: token inválido");
    return new Response("invalid token", { status: 401 });
  }
  try {
    await syncPaymentStatus(payment.id);
  } catch (err) {
    console.error("[asaas] falha ao sincronizar", providerPaymentId, err);
    return new Response("sync failed", { status: 500 }); // o Asaas tenta de novo
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

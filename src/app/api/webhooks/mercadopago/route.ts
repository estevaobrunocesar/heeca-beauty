import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MercadoPagoProvider } from "@/lib/payments/providers/mercadopago";
import { syncPaymentStatus } from "@/lib/payments/service";

/**
 * Webhook do Mercado Pago (Notificações → Webhooks → evento "Pagamentos").
 * Nunca confiamos no payload: só pegamos o id e reconsultamos a API.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => null);
  let ids: string[];
  try {
    ids = MercadoPagoProvider.parseWebhook(url, body, req.headers);
  } catch (err) {
    console.warn("[mercadopago] webhook rejeitado:", err instanceof Error ? err.message : err);
    return new Response("invalid signature", { status: 401 });
  }

  for (const providerPaymentId of ids) {
    const payment = await db.payment.findUnique({ where: { providerPaymentId }, select: { id: true } });
    if (!payment) continue; // pagamento de outro sistema na mesma conta MP
    try {
      await syncPaymentStatus(payment.id);
    } catch (err) {
      console.error("[mercadopago] falha ao sincronizar", providerPaymentId, err);
    }
  }
  return NextResponse.json({ ok: true });
}

// A MP também faz GET ao cadastrar a URL em alguns fluxos.
export async function GET() {
  return NextResponse.json({ ok: true });
}

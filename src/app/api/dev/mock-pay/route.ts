import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markPaymentPaid } from "@/lib/payments/service";

/**
 * Simula a confirmação de um Pix — só funciona para cobranças do provedor "mock"
 * e nunca em produção. Usado pelo botão "Simular pagamento" da página /pagar.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("not found", { status: 404 });
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  const appt = await db.appointment.findUnique({ where: { confirmationToken: token }, select: { payment: true } });
  if (!appt?.payment || appt.payment.provider !== "mock") return NextResponse.json({ ok: false, error: "não é uma cobrança mock" }, { status: 400 });
  if (appt.payment.status !== "PENDING") return NextResponse.json({ ok: false, error: `cobrança já está ${appt.payment.status}` }, { status: 409 });

  await markPaymentPaid(appt.payment.id);
  return NextResponse.json({ ok: true });
}

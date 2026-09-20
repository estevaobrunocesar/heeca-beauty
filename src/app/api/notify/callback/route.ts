import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { handleEvent } from "@/lib/whatsapp/inbound";
import type { InboundEvent } from "@/lib/whatsapp/provider";

export const dynamic = "force-dynamic";

/**
 * Heeca Notify → produto: status de entrega e respostas da cliente, no mesmo formato de evento
 * que o webhook da Meta gerava. Assinado com NOTIFY_SECRET (HMAC ts.corpo), como o portal faz.
 */
function verify(raw: string, headers: Headers): boolean {
  const secret = process.env.NOTIFY_SECRET ?? "";
  const ts = headers.get("x-heeca-timestamp") ?? "";
  const sig = headers.get("x-heeca-signature") ?? "";
  if (secret.length < 16 || !/^\d+$/.test(ts) || Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verify(raw, req.headers)) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  let ev: InboundEvent;
  try {
    ev = JSON.parse(raw) as InboundEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!ev || !["status", "button_reply", "text"].includes(ev.type)) return NextResponse.json({ error: "evento desconhecido" }, { status: 400 });
  try {
    await handleEvent(ev);
  } catch (err) {
    console.error("[notify:callback]", ev.type, err);
    return NextResponse.json({ ok: false }, { status: 500 }); // o Notify reenvia
  }
  return NextResponse.json({ ok: true });
}

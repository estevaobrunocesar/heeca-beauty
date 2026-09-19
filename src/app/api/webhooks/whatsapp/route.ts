import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MetaCloudProvider } from "@/lib/whatsapp/providers/meta";
import { handleEvent } from "@/lib/whatsapp/inbound";
import type { InboundEvent } from "@/lib/whatsapp/provider";

/** Verificação do webhook (Meta chama GET com hub.challenge ao cadastrar a URL). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

function validSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // sem segredo configurado (dev) não valida
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = header.slice(7);
  return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

/**
 * Recebe eventos da Meta: respostas de botão (confirmar/cancelar), textos e status de entrega.
 * Sempre responde 200 rapidamente; a Meta reenvia em caso de erro.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("invalid signature", { status: 401 });
  }

  let events: InboundEvent[] = [];
  try {
    events = MetaCloudProvider.parseWebhook(JSON.parse(raw));
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  for (const ev of events) {
    try {
      await handleEvent(ev);
    } catch (err) {
      console.error("[webhook:whatsapp]", ev, err);
    }
  }
  return NextResponse.json({ ok: true });
}


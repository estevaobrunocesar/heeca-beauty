import { NextResponse } from "next/server";
import { applyEntitlement, platformEnabled, verifySignature, type Entitlement } from "@/lib/heeca/service";

/** Portal → Nail: plano/status mudaram. Só espelha; nunca cobra. */
export async function POST(req: Request) {
  if (!platformEnabled()) return NextResponse.json({ error: "integração com o portal desativada" }, { status: 503 });
  const raw = await req.text();
  try {
    verifySignature(raw, req.headers);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "não autorizado" }, { status: 401 });
  }
  try {
    await applyEntitlement(JSON.parse(raw) as Entitlement);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    console.error("[heeca] entitlement falhou:", msg);
    return NextResponse.json({ error: msg }, { status: /não provisionado/i.test(msg) ? 404 : 500 });
  }
}

import { NextResponse } from "next/server";
import { platformEnabled, provision, verifySignature, type Entitlement } from "@/lib/heeca/service";
import { appUrlDe } from "@/lib/marca-atual";
import { marcaPorSlug } from "@/lib/marca";

/** Portal → motor: cria o estabelecimento da assinatura (idempotente). Contrato: heeca_site/docs/ENTITLEMENT.md */
export async function POST(req: Request) {
  if (!platformEnabled()) return NextResponse.json({ error: "integração com o portal desativada" }, { status: 503 });
  const raw = await req.text();
  try {
    verifySignature(raw, req.headers);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "não autorizado" }, { status: 401 });
  }
  try {
    const t = await provision(JSON.parse(raw) as Entitlement);
    return NextResponse.json({ tenantId: t.id, slug: t.slug, appUrl: `${appUrlDe(marcaPorSlug(t.marca))}/app` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    console.error("[heeca] provision falhou:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

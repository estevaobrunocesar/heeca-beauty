import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { platformEnabled, resolveSsoUser, verifySsoToken } from "@/lib/heeca/service";

/** Portal → navegador → Nail: troca o JWT de 60 s por uma sessão local. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Atrás do proxy, req.url traz a origem interna do container: redirects usam APP_URL.
  const origin = (process.env.APP_URL ?? url.origin).replace(/\/+$/, "");
  const fail = (msg: string) => NextResponse.redirect(new URL(`/login?sso_error=${encodeURIComponent(msg)}`, origin));
  if (!platformEnabled()) return fail("Login pela conta Heeca não está ativado neste ambiente.");
  const token = url.searchParams.get("token");
  if (!token) return fail("Token ausente.");
  try {
    const claims = await verifySsoToken(token);
    const { userId, tenantId } = await resolveSsoUser(claims);
    await createSession({ userId, tenantId });
    const next = url.searchParams.get("next");
    const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
    return NextResponse.redirect(new URL(dest, origin));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível entrar pela conta Heeca.");
  }
}

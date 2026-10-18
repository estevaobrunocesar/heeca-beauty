import "server-only";
import { redirect } from "next/navigation";
import { requireAuth, type AuthContext } from "@/lib/auth/session";
import { moduloClinicoAtivo } from "./rules";

/**
 * Porta das páginas do módulo clínico: a recepção não vê dado clínico (SPEC §6), o módulo só existe para
 * quem atende Estética, e protocolos são de gestão. Quem não passa volta ao painel — nunca vê erro 500.
 */
export async function exigirClinico(opts: { gestao?: boolean } = {}): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.role === "RECEPTION" || !moduloClinicoAtivo(ctx.tenant.segmentos) || (opts.gestao && !ctx.canManage)) redirect("/app");
  return ctx;
}

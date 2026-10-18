import "server-only";
import { db } from "@/lib/db";
import { activeProfessionals, type AuthContext } from "@/lib/auth/session";

/** Listas que o formulário de avaliação precisa (clientes, equipe, protocolos ativos, serviços do catálogo). */
export async function opcoesDeAvaliacao(ctx: AuthContext) {
  const tenantId = ctx.tenant.id;
  const [clientes, protocolos, servicos] = await Promise.all([
    db.client.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
    db.protocol.findMany({ where: { tenantId, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, sessionsCount: true } }),
    db.service.findMany({ where: { tenantId, active: true, deletedAt: null, isAddOn: false }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    clients: clientes.map((c) => ({ id: c.id, label: `${c.name} · ${c.phone}` })),
    professionals: activeProfessionals(ctx).map((p) => ({ id: p.id, name: p.name })),
    protocols: protocolos.map((p) => ({ id: p.id, name: p.name, sessions: p.sessionsCount })),
    services: servicos,
  };
}

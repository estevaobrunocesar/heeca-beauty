import "server-only";
import { db } from "@/lib/db";
import { escolherPacote, itemCabeNoPacote, progresso, statusDaSessao, statusDoPacote, type Progresso, type RegraFalta } from "./rules";

/**
 * Pacotes de sessões — camada de serviço. Liga a agenda ao pacote:
 *  - ao criar uma visita, `vincularVisita` reserva sessões de pacotes ativos do cliente que cubram os itens;
 *  - a cada transição de status, `espelharVisita` atualiza as sessões (realizada, falta, cancelada);
 *  - `sincronizarStatus` recalcula ACTIVE/COMPLETED/EXPIRED a partir do progresso (o saldo nunca é gravado).
 */
export const regraFaltaDe = (t: { faltaConsomeSessao: boolean }): RegraFalta => (t.faltaConsomeSessao ? "CONSOME" : "LIBERA");

const pacoteInclude = { sessions: { select: { status: true } } } as const;

export async function progressoDe(tenantId: string, clientPackageId: string, regra: RegraFalta): Promise<Progresso | null> {
  const p = await db.clientPackage.findFirst({ where: { id: clientPackageId, tenantId }, include: pacoteInclude });
  return p ? progresso(p, p.sessions, regra) : null;
}

/** Recalcula o status gravado a partir do progresso; devolve o progresso. */
export async function sincronizarStatus(tenantId: string, clientPackageId: string, regra: RegraFalta, agora = new Date()) {
  const p = await db.clientPackage.findFirst({ where: { id: clientPackageId, tenantId }, include: pacoteInclude });
  if (!p) return null;
  const prog = progresso(p, p.sessions, regra, agora);
  const status = statusDoPacote(p, prog);
  if (status !== p.status) await db.clientPackage.update({ where: { id: p.id }, data: { status, closedAt: status === "ACTIVE" ? null : (p.closedAt ?? agora) } });
  return prog;
}

/**
 * Ao criar uma visita: para cada item sem sessão, procura um pacote ATIVO do cliente com saldo livre que
 * cubra o serviço e vincula. Preferência: serviço > categoria > livre; entre iguais, o que vence primeiro.
 * Devolve quantas sessões foram reservadas.
 */
export async function vincularVisita(tenant: { id: string; faltaConsomeSessao: boolean }, appointmentId: string) {
  const appt = await db.appointment.findFirst({
    where: { id: appointmentId, tenantId: tenant.id },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { service: { select: { categoryId: true } }, packageSession: { select: { id: true } } } } },
  });
  if (!appt) return 0;
  const pacotes = await db.clientPackage.findMany({ where: { tenantId: tenant.id, clientId: appt.clientId, status: "ACTIVE" }, include: pacoteInclude });
  if (pacotes.length === 0) return 0;
  const regra = regraFaltaDe(tenant);
  const disponiveis = new Map(pacotes.map((p) => [p.id, progresso(p, p.sessions, regra).disponiveis]));
  let vinculadas = 0;
  for (const item of appt.items) {
    if (item.packageSession) continue;
    const pk = escolherPacote(pacotes, disponiveis, { clientId: appt.clientId, serviceId: item.serviceId, categoryId: item.service.categoryId });
    if (!pk) continue;
    await db.packageSession.create({ data: { tenantId: tenant.id, clientPackageId: pk.id, itemId: item.id, status: statusDaSessao(appt.status), performedAt: appt.status === "COMPLETED" ? item.startsAt : null } });
    disponiveis.set(pk.id, (disponiveis.get(pk.id) ?? 1) - 1);
    vinculadas++;
  }
  for (const p of pacotes) await sincronizarStatus(tenant.id, p.id, regra);
  return vinculadas;
}

/** Vínculo manual (painel): o item cabe no pacote e há saldo? Cria a sessão espelhando o status da visita. */
export async function vincularItem(tenant: { id: string; faltaConsomeSessao: boolean }, clientPackageId: string, itemId: string) {
  const [pk, item] = await Promise.all([
    db.clientPackage.findFirst({ where: { id: clientPackageId, tenantId: tenant.id }, include: pacoteInclude }),
    db.appointmentItem.findFirst({ where: { id: itemId, tenantId: tenant.id }, include: { appointment: { select: { clientId: true, status: true } }, service: { select: { categoryId: true } }, packageSession: { select: { id: true } } } }),
  ]);
  if (!pk || !item) throw new Error("Pacote ou atendimento não encontrado.");
  if (item.packageSession) throw new Error("Este atendimento já está vinculado a um pacote.");
  const cabe = itemCabeNoPacote(pk, { clientId: item.appointment.clientId, serviceId: item.serviceId, categoryId: item.service.categoryId });
  if (!cabe.ok) throw new Error(cabe.motivo);
  const regra = regraFaltaDe(tenant);
  const prog = progresso(pk, pk.sessions, regra);
  if (pk.status !== "ACTIVE" || prog.disponiveis <= 0) throw new Error("O pacote não tem sessões disponíveis.");
  await db.packageSession.create({ data: { tenantId: tenant.id, clientPackageId: pk.id, itemId: item.id, status: statusDaSessao(item.appointment.status), performedAt: item.appointment.status === "COMPLETED" ? item.startsAt : null } });
  await sincronizarStatus(tenant.id, pk.id, regra);
}

export async function desvincularItem(tenant: { id: string; faltaConsomeSessao: boolean }, itemId: string) {
  const s = await db.packageSession.findFirst({ where: { itemId, tenantId: tenant.id }, select: { id: true, clientPackageId: true } });
  if (!s) return;
  await db.packageSession.delete({ where: { id: s.id } });
  await sincronizarStatus(tenant.id, s.clientPackageId, regraFaltaDe(tenant));
}

/**
 * Chamado pela transição de status da visita: sessões dos itens espelham o status. Devolve os pacotes
 * tocados com o saldo novo (para a mensagem "você ainda possui X sessões").
 */
export async function espelharVisita(appointmentId: string) {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, include: { items: { include: { packageSession: true } }, tenant: { select: { id: true, faltaConsomeSessao: true } } } });
  if (!appt) return [];
  const sessoes = appt.items.map((it) => it.packageSession).filter((s): s is NonNullable<typeof s> => !!s);
  if (sessoes.length === 0) return [];
  const status = statusDaSessao(appt.status);
  for (const s of sessoes) if (s.status !== status) await db.packageSession.update({ where: { id: s.id }, data: { status, performedAt: status === "DONE" ? (s.performedAt ?? appt.startsAt) : null } });
  const regra = regraFaltaDe(appt.tenant);
  const tocados: { id: string; name: string; expiresAt: Date | null; progresso: Progresso }[] = [];
  for (const id of new Set(sessoes.map((s) => s.clientPackageId))) {
    const prog = await sincronizarStatus(appt.tenant.id, id, regra);
    const pk = await db.clientPackage.findUnique({ where: { id }, select: { id: true, name: true, expiresAt: true } });
    if (pk && prog) tocados.push({ ...pk, progresso: prog });
  }
  return tocados;
}

/** Cron diário: pacotes ativos que venceram passam a EXPIRED (e concluídos por engano voltam ao certo). */
export async function expirarPacotes(agora = new Date()) {
  const ativos = await db.clientPackage.findMany({ where: { status: "ACTIVE", expiresAt: { not: null, lt: agora } }, select: { id: true, tenantId: true, tenant: { select: { faltaConsomeSessao: true } } } });
  let n = 0;
  for (const p of ativos) {
    const prog = await sincronizarStatus(p.tenantId, p.id, regraFaltaDe(p.tenant), agora);
    if (prog?.vencido) n++;
  }
  return n;
}

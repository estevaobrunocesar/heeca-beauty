import { db } from "@/lib/db";
import { cashbackGanho, creditoPendente } from "./rules";

export async function saldoDoCliente(tenantId: string, clientId: string): Promise<number> {
  const r = await db.cashbackEntry.aggregate({ where: { tenantId, clientId }, _sum: { amountCents: true } });
  return r._sum.amountCents ?? 0;
}

/** Saldos de várias clientes de uma vez (listas). */
export async function saldosDosClientes(tenantId: string, clientIds: string[]): Promise<Map<string, number>> {
  if (clientIds.length === 0) return new Map();
  const rows = await db.cashbackEntry.groupBy({ by: ["clientId"], where: { tenantId, clientId: { in: clientIds } }, _sum: { amountCents: true } });
  return new Map(rows.map((r) => [r.clientId, r._sum.amountCents ?? 0]));
}

const liquidoDoAtendimento = async (appointmentId: string) =>
  (await db.cashbackEntry.aggregate({ where: { appointmentId, kind: { in: ["EARN", "REVERSAL"] } }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;

/** Concluiu: credita o cashback dos serviços. Idempotente; sem percentual configurado não faz nada. */
export async function creditarCashbackDoAtendimento(appointmentId: string) {
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: { tenantId: true, clientId: true, tenant: { select: { cashbackPercent: true } }, items: { select: { priceCents: true } } },
  });
  if (!appt || appt.tenant.cashbackPercent <= 0) return;
  const esperado = cashbackGanho(appt.items.reduce((n, i) => n + i.priceCents, 0), appt.tenant.cashbackPercent);
  const falta = creditoPendente(esperado, await liquidoDoAtendimento(appointmentId));
  if (falta <= 0) return;
  await db.cashbackEntry.create({ data: { tenantId: appt.tenantId, clientId: appt.clientId, appointmentId, kind: "EARN", amountCents: falta, note: "Atendimento concluído" } });
}

/** Reabriu um atendimento concluído: devolve o crédito que ele havia dado. */
export async function estornarCashbackDoAtendimento(appointmentId: string) {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, select: { tenantId: true, clientId: true } });
  if (!appt) return;
  const liquido = await liquidoDoAtendimento(appointmentId);
  if (liquido <= 0) return;
  await db.cashbackEntry.create({ data: { tenantId: appt.tenantId, clientId: appt.clientId, appointmentId, kind: "REVERSAL", amountCents: -liquido, note: "Atendimento reaberto" } });
}

import { db } from "@/lib/db";
import { addDaysToKey, zonedDateTimeToUtc, type DateKey } from "@/lib/dates";
import { caixaEsperado, chaveDaDespesa, diaDaDespesa, type CaixaEntrada, type Despesa, type Method, type Receita } from "./rules";

export type ReceitaDoDia = Receita & { id: string; at: Date; clientName: string; serviceName: string };
export type DespesaDoDia = Despesa & { id: string; description: string; day: string; notes: string | null };

/** Atendimentos concluídos no período (pelo dia de `completedAt`; antigos sem ele valem pelo início da visita). */
export async function receitasDoPeriodo(tenant: { id: string; timezone: string }, periodo: { de: DateKey; ate: DateKey }): Promise<ReceitaDoDia[]> {
  const from = zonedDateTimeToUtc(periodo.de, 0, tenant.timezone);
  const to = zonedDateTimeToUtc(addDaysToKey(periodo.ate, 1), 0, tenant.timezone);
  const rows = await db.appointment.findMany({
    where: {
      tenantId: tenant.id, status: "COMPLETED",
      OR: [{ completedAt: { gte: from, lt: to } }, { completedAt: null, startsAt: { gte: from, lt: to } }],
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true, startsAt: true, completedAt: true, paymentMethod: true, serviceName: true,
      client: { select: { name: true } },
      items: { select: { priceCents: true } }, charges: { select: { amountCents: true } },
    },
  });
  return rows.map((a) => ({
    id: a.id, at: a.completedAt ?? a.startsAt, method: a.paymentMethod as Method | null, clientName: a.client.name, serviceName: a.serviceName,
    cents: a.items.reduce((n, i) => n + i.priceCents, 0) + a.charges.reduce((n, c) => n + c.amountCents, 0),
  }));
}

export async function despesasDoPeriodo(tenantId: string, periodo: { de: DateKey; ate: DateKey }): Promise<DespesaDoDia[]> {
  const rows = await db.expense.findMany({
    where: { tenantId, spentAt: { gte: diaDaDespesa(periodo.de), lte: diaDaDespesa(periodo.ate) } },
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((e) => ({ id: e.id, description: e.description, category: e.category, cents: e.amountCents, method: e.method as Method, day: chaveDaDespesa(e.spentAt), notes: e.notes }));
}

export async function caixaAbertoDe(tenantId: string) {
  return db.cashSession.findFirst({ where: { tenantId, closedAt: null }, orderBy: { openedAt: "desc" } });
}

/** Tudo que mexeu no dinheiro da gaveta durante a sessão, e o esperado resultante. */
export async function situacaoDoCaixa(session: { id: string; tenantId: string; openedAt: Date; closedAt: Date | null; openingCents: number }) {
  const ate = session.closedAt ?? new Date();
  const [recebidos, despesas, movimentos] = await Promise.all([
    db.appointment.findMany({
      where: { tenantId: session.tenantId, status: "COMPLETED", paymentMethod: "CASH", completedAt: { gte: session.openedAt, lte: ate } },
      select: { id: true, serviceName: true, client: { select: { name: true } }, items: { select: { priceCents: true } }, charges: { select: { amountCents: true } } },
    }),
    db.expense.findMany({ where: { cashSessionId: session.id, method: "CASH" }, select: { amountCents: true } }),
    db.cashMovement.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const entrada: CaixaEntrada = {
    openingCents: session.openingCents,
    recebidoDinheiroCents: recebidos.reduce((n, a) => n + a.items.reduce((m, i) => m + i.priceCents, 0) + a.charges.reduce((m, c) => m + c.amountCents, 0), 0),
    despesasDinheiroCents: despesas.reduce((n, e) => n + e.amountCents, 0),
    suprimentoCents: movimentos.filter((m) => m.kind === "SUPPLY").reduce((n, m) => n + m.amountCents, 0),
    sangriaCents: movimentos.filter((m) => m.kind === "WITHDRAWAL").reduce((n, m) => n + m.amountCents, 0),
  };
  return { entrada, esperadoCents: caixaEsperado(entrada), movimentos, atendimentos: recebidos.length };
}

import { db } from "@/lib/db";
import { addDaysToKey, todayKey, zonedDateTimeToUtc, type DateKey } from "@/lib/dates";
import { buildReport, type ReportAppointment } from "./summary";

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

/** Período "de" até "ate" (inclusive, DateKey no fuso do estabelecimento). Inválido ou sem valor = mês corrente. */
export function parsePeriodo(sp: { de?: unknown; ate?: unknown }, tz: string): { de: DateKey; ate: DateKey } {
  const hoje = todayKey(tz);
  const padrao = { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
  const de = typeof sp.de === "string" && KEY_RE.test(sp.de) ? sp.de : null;
  const ate = typeof sp.ate === "string" && KEY_RE.test(sp.ate) ? sp.ate : null;
  if (!de || !ate || de > ate) return padrao;
  // Limita o intervalo para a consulta não varrer anos de agenda de uma vez.
  const limite = addDaysToKey(de, MAX_DIAS - 1);
  return { de, ate: ate > limite ? limite : ate };
}

/** Atendimentos do período (pelo início da visita) já no formato do relatório + o relatório calculado. */
export async function carregarRelatorio(tenant: { id: string; timezone: string }, periodo: { de: DateKey; ate: DateKey }, unitId?: string | null) {
  const from = zonedDateTimeToUtc(periodo.de, 0, tenant.timezone);
  const to = zonedDateTimeToUtc(addDaysToKey(periodo.ate, 1), 0, tenant.timezone);

  const rows = await db.appointment.findMany({
    where: { tenantId: tenant.id, startsAt: { gte: from, lt: to }, ...(unitId ? { unitId } : {}) },
    orderBy: { startsAt: "asc" },
    select: {
      id: true, startsAt: true, status: true, source: true, clientId: true,
      client: { select: { name: true } },
      charges: { select: { amountCents: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          professionalId: true, serviceId: true, serviceName: true, priceCents: true, commissionCents: true,
          professional: { select: { name: true } },
          service: { select: { category: { select: { name: true } } } },
        },
      },
    },
  });

  const appointments: ReportAppointment[] = rows.map((a) => ({
    id: a.id, startsAt: a.startsAt, status: a.status, source: a.source,
    clientId: a.clientId, clientName: a.client.name,
    chargesCents: a.charges.reduce((n, c) => n + c.amountCents, 0),
    items: a.items.map((i) => ({
      professionalId: i.professionalId, professionalName: i.professional.name,
      serviceId: i.serviceId, serviceName: i.serviceName, categoryName: i.service.category?.name ?? null,
      priceCents: i.priceCents, commissionCents: i.commissionCents,
    })),
  }));

  const concluidasNoPeriodo = [...new Set(appointments.filter((a) => a.status === "COMPLETED").map((a) => a.clientId))];
  const antigas = concluidasNoPeriodo.length
    ? await db.appointment.findMany({
        where: { tenantId: tenant.id, status: "COMPLETED", startsAt: { lt: from }, clientId: { in: concluidasNoPeriodo } },
        distinct: ["clientId"], select: { clientId: true },
      })
    : [];

  return {
    appointments,
    relatorio: buildReport(appointments, { tz: tenant.timezone, clientesComHistorico: new Set(antigas.map((a) => a.clientId)) }),
  };
}

import { db } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/appointments/status";
import type { DateKey } from "@/lib/dates";
import { estaInativa, periodoDaCampanha, proximoAniversario } from "./rules";

export type Destinataria = { id: string; name: string; phone: string | null; enviada: boolean; detalhe: string; ordem: number;
  /** Aniversário: a data do aniversário (define o ano do envio). Reativação: hoje (define o mês). */
  dia: DateKey };

/** Aniversariantes de hoje até `dias` dias adiante. Cada um traz se a campanha já foi enviada para o ano do aniversário. */
export async function aniversariantes(tenantId: string, hoje: DateKey, dias: number): Promise<Destinataria[]> {
  const clientes = await db.client.findMany({ where: { tenantId, birthDate: { not: null } }, select: { id: true, name: true, phone: true, birthDate: true } });
  const proximos = clientes.flatMap((c) => {
    const p = c.birthDate ? proximoAniversario(c.birthDate, hoje, dias) : null;
    return p ? [{ c, ...p }] : [];
  });
  if (proximos.length === 0) return [];
  const enviados = await db.campaignSend.findMany({
    where: { tenantId, kind: "BIRTHDAY", clientId: { in: proximos.map((p) => p.c.id) } },
    select: { clientId: true, periodKey: true },
  });
  const jaFoi = new Set(enviados.map((e) => `${e.clientId}:${e.periodKey}`));
  return proximos
    .map(({ c, dia, emDias }) => ({
      id: c.id, name: c.name, phone: c.phone,
      dia, enviada: jaFoi.has(`${c.id}:${periodoDaCampanha("BIRTHDAY", dia)}`),
      detalhe: emDias === 0 ? "faz aniversário hoje" : emDias === 1 ? "amanhã" : `em ${emDias} dias (${dia.slice(8, 10)}/${dia.slice(5, 7)})`,
      ordem: emDias,
    }))
    .sort((a, b) => a.ordem - b.ordem || a.name.localeCompare(b.name, "pt-BR"));
}

/** Clientes sem voltar há `dias` dias ou mais (e sem agendamento futuro), das que ficaram há mais tempo para as mais recentes. */
export async function clientesParaReativar(tenantId: string, hoje: DateKey, dias: number, agora = new Date()): Promise<Destinataria[]> {
  const [ultimas, futuras] = await Promise.all([
    db.appointment.groupBy({ by: ["clientId"], where: { tenantId, status: "COMPLETED" }, _max: { startsAt: true } }),
    db.appointment.groupBy({ by: ["clientId"], where: { tenantId, status: { in: ACTIVE_STATUSES }, startsAt: { gt: agora } } }),
  ]);
  const comFuturo = new Set(futuras.map((f) => f.clientId));
  const inativas = ultimas.flatMap((u) => {
    const r = estaInativa({ ultimaVisita: u._max.startsAt, temAgendamentoFuturo: comFuturo.has(u.clientId), agora, dias });
    return r.inativa ? [{ clientId: u.clientId, diasSemVir: r.diasSemVir ?? 0 }] : [];
  });
  if (inativas.length === 0) return [];
  const periodo = periodoDaCampanha("REACTIVATION", hoje);
  const [clientes, enviados] = await Promise.all([
    db.client.findMany({ where: { tenantId, id: { in: inativas.map((i) => i.clientId) } }, select: { id: true, name: true, phone: true } }),
    db.campaignSend.findMany({ where: { tenantId, kind: "REACTIVATION", periodKey: periodo, clientId: { in: inativas.map((i) => i.clientId) } }, select: { clientId: true } }),
  ]);
  const jaFoi = new Set(enviados.map((e) => e.clientId));
  const dias_ = new Map(inativas.map((i) => [i.clientId, i.diasSemVir]));
  return clientes
    .map((c) => ({ id: c.id, name: c.name, phone: c.phone, dia: hoje, enviada: jaFoi.has(c.id), detalhe: `sem vir há ${dias_.get(c.id)} dias`, ordem: -(dias_.get(c.id) ?? 0) }))
    .sort((a, b) => a.ordem - b.ordem || a.name.localeCompare(b.name, "pt-BR"));
}

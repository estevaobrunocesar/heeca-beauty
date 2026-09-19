/**
 * Regras de relacionamento com a cliente (seções 9 e 11): frequência de visitas,
 * cliente recorrente e previsão da próxima manutenção. Funções puras, sem banco.
 */

const DAY = 86_400_000;

/** Média de dias entre atendimentos concluídos (null se houve menos de 2). */
export function averageIntervalDays(completedDates: Date[]): number | null {
  if (completedDates.length < 2) return null;
  const sorted = [...completedDates].sort((a, b) => a.getTime() - b.getTime());
  const span = sorted[sorted.length - 1].getTime() - sorted[0].getTime();
  return Math.round(span / DAY / (sorted.length - 1));
}

/**
 * Cliente recorrente = voltou ao menos uma vez nos últimos 90 dias
 * (2+ atendimentos concluídos na janela). É o indicador "Clientes recorrentes" do painel.
 *
 * Alternativas que fazem sentido para o segmento: exigir 3 visitas em 6 meses (mais rigoroso)
 * ou considerar apenas alongamento/manutenção (ignorando esmaltações avulsas).
 */
export function isRecurring(completedDates: Date[], now = new Date(), windowDays = 90): boolean {
  const since = now.getTime() - windowDays * DAY;
  return completedDates.filter((d) => d.getTime() >= since).length >= 2;
}

export type MaintenanceStatus =
  | { kind: "unknown" } // sem histórico ou sem intervalo conhecido
  | { kind: "ok"; dueAt: Date; daysLeft: number } // ainda dentro do ciclo
  | { kind: "due"; dueAt: Date; daysOverdue: number }; // passou do ciclo e não tem nada agendado

/**
 * Quando a cliente "deveria" voltar. Usa o intervalo cadastrado na ficha
 * (maintenanceIntervalDays) ou, na falta dele, a média observada do histórico.
 * Se já existe um agendamento futuro ativo, não há o que cobrar.
 */
export function maintenanceStatus(input: {
  lastCompletedAt: Date | null;
  intervalDays: number | null;
  observedIntervalDays: number | null;
  hasUpcoming: boolean;
  now?: Date;
}): MaintenanceStatus {
  const { lastCompletedAt, hasUpcoming } = input;
  const interval = input.intervalDays ?? input.observedIntervalDays;
  if (!lastCompletedAt || !interval || hasUpcoming) return { kind: "unknown" };
  const now = input.now ?? new Date();
  const dueAt = new Date(lastCompletedAt.getTime() + interval * DAY);
  const diffDays = Math.round((dueAt.getTime() - now.getTime()) / DAY);
  return diffDays >= 0 ? { kind: "ok", dueAt, daysLeft: diffDays } : { kind: "due", dueAt, daysOverdue: -diffDays };
}

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

// ─── Retorno inteligente (feature da família; veio do protótipo Heeca Brow, SPEC §14 e §21) ─────

/** Dias antes do retorno previsto em que a cliente já aparece como "chegando a hora" no painel. */
export const APPROACHING_WINDOW_DAYS = 5;
/** Até quantos dias depois da data prevista ainda é "no ponto"; depois vira "atrasada". */
export const DUE_GRACE_DAYS = 7;
/** Sem atendimento há este tanto de dias = cliente inativa, independentemente do ciclo. */
export const INACTIVE_AFTER_DAYS = 90;
/** Intervalos fora desta faixa não ensinam o ciclo: menos de 7 dias é retoque, mais de 120 é pausa (férias, gravidez). */
export const MIN_GAP_DAYS = 7;
export const MAX_GAP_DAYS = 120;
const LEARN_LAST_GAPS = 3;

export type ReturnStage =
  | "unknown" // sem histórico, sem intervalo confiável, longe da data ou já tem horário marcado
  | "approaching" // faltam até APPROACHING_WINDOW_DAYS para a data prevista
  | "due" // chegou a data (até DUE_GRACE_DAYS depois)
  | "overdue" // passou da data + carência
  | "inactive"; // sem atendimento há INACTIVE_AFTER_DAYS ou mais

export type ReturnPrediction = {
  stage: ReturnStage;
  /** Intervalo usado na previsão e de onde veio. */
  intervalDays: number | null;
  source: "declared" | "learned" | "none";
  dueAt: Date | null;
  /** Negativo = já passou. */
  daysUntilDue: number | null;
  daysSinceLast: number | null;
};

/**
 * Aprende o intervalo habitual da cliente pelas datas dos atendimentos concluídos.
 * Regra: mediana dos últimos 3 intervalos válidos — só o ciclo recente conta, e a mediana
 * ignora um intervalo destoante no meio. Null = ainda não dá para confiar (o painel mostra
 * "unknown" em vez de cobrar a cliente na hora errada).
 */
export function learnIntervalDays(completedDates: Date[]): number | null {
  const sorted = completedDates.map((d) => d.getTime()).sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((t, i) => Math.round((t - sorted[i]) / DAY));
  const recent = gaps.filter((g) => g >= MIN_GAP_DAYS && g <= MAX_GAP_DAYS).slice(-LEARN_LAST_GAPS).sort((a, b) => a - b);
  if (recent.length === 0) return null;
  const mid = Math.floor(recent.length / 2);
  return recent.length % 2 === 1 ? recent[mid] : Math.round((recent[mid - 1] + recent[mid]) / 2);
}

/**
 * Em que estágio do ciclo a cliente está e quando deve voltar. O intervalo declarado na ficha
 * (`Client.maintenanceIntervalDays`) tem prioridade sobre o aprendido. Com horário futuro
 * marcado nunca há o que cobrar; inatividade (90+ dias) vale mesmo sem ciclo conhecido.
 */
export function predictReturn(input: { completedDates: Date[]; declaredIntervalDays: number | null; hasUpcoming: boolean; now?: Date }): ReturnPrediction {
  const now = input.now ?? new Date();
  const last = input.completedDates.reduce<Date | null>((m, d) => (!m || d > m ? d : m), null);
  const none: ReturnPrediction = { stage: "unknown", intervalDays: null, source: "none", dueAt: null, daysUntilDue: null, daysSinceLast: null };
  if (!last) return none;

  const daysSinceLast = Math.floor((now.getTime() - last.getTime()) / DAY);
  const learned = input.declaredIntervalDays ? null : learnIntervalDays(input.completedDates);
  const intervalDays = input.declaredIntervalDays ?? learned;
  const source: ReturnPrediction["source"] = input.declaredIntervalDays ? "declared" : learned ? "learned" : "none";
  const base: ReturnPrediction = { ...none, intervalDays, source, daysSinceLast };

  if (input.hasUpcoming) return base;
  if (daysSinceLast >= INACTIVE_AFTER_DAYS) return { ...base, stage: "inactive" };
  if (!intervalDays) return base;

  const dueAt = new Date(last.getTime() + intervalDays * DAY);
  const daysUntilDue = Math.round((dueAt.getTime() - now.getTime()) / DAY);
  const stage: ReturnStage =
    daysUntilDue > APPROACHING_WINDOW_DAYS ? "unknown"
    : daysUntilDue > 0 ? "approaching"
    : daysUntilDue >= -DUE_GRACE_DAYS ? "due"
    : "overdue";
  return { ...base, stage, dueAt, daysUntilDue };
}

/** Ordem de urgência no painel: quem já está no ponto primeiro, depois quem se aproxima, por fim inativas. */
export const RETURN_STAGE_ORDER: Record<ReturnStage, number> = { due: 0, overdue: 1, approaching: 2, inactive: 3, unknown: 9 };

/** Rótulo curto para o painel. */
export const RETURN_STAGE_LABELS: Record<Exclude<ReturnStage, "unknown">, string> = {
  approaching: "chegando a hora",
  due: "no ponto de voltar",
  overdue: "atrasada",
  inactive: "inativa",
};

/**
 * Mensagem sugerida para o WhatsApp. A profissional decide se e quando envia — nada é
 * disparado automaticamente nesta fase. O vocabulário vem do segmento do estabelecimento
 * (`fraseDeRetorno(segmentos)`: "cuidar novamente das suas sobrancelhas", "renovar suas unhas"…).
 */
export function returnMessage(firstName: string, stage: ReturnStage, convite: string): string {
  const name = firstName.trim().split(/\s+/)[0] || "tudo bem";
  if (stage === "inactive" || stage === "overdue") {
    return `Oi, ${name}! 💕\nSentimos sua falta!\nJá faz um tempinho desde seu último atendimento. Que tal agendar seu próximo horário?`;
  }
  return `Oi, ${name}! 💕\n${convite}\nQuer reservar seu próximo horário?`;
}

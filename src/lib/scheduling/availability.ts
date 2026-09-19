import { zonedDateTimeToUtc, toMinutesOfDay, toDateKey, type DateKey } from "@/lib/dates";

/** Intervalo em minutos do dia [start, end). */
export type MinuteRange = { start: number; end: number };

export type WeeklyRule = {
  startMinutes: number;
  endMinutes: number;
  breakStartMinutes: number | null;
  breakEndMinutes: number | null;
};

export type DayException =
  | { kind: "CLOSED" }
  | { kind: "CUSTOM_HOURS"; startMinutes: number; endMinutes: number };

export type UtcRange = { startsAt: Date; endsAt: Date };

export type AvailabilityInput = {
  dateKey: DateKey;
  tz: string;
  now: Date;
  rule: WeeklyRule | null;
  exception: DayException | null;
  blocks: UtcRange[];       // bloqueios/férias que tocam o dia
  appointments: UtcRange[]; // agendamentos ativos (não cancelados) do dia
  durationMinutes: number;  // duração do serviço escolhido
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
  maxConcurrent: number;
  maxDailyAppointments?: number | null; // limite de atendimentos no dia (null/undefined = sem limite)
};

export type Slot = { minutes: number; startsAt: Date; endsAt: Date };

/** Janelas de atendimento do dia (já considerando folga, horário excepcional e almoço). */
export function openWindows(rule: WeeklyRule | null, exception: DayException | null): MinuteRange[] {
  if (exception?.kind === "CLOSED") return [];
  if (exception?.kind === "CUSTOM_HOURS") return [{ start: exception.startMinutes, end: exception.endMinutes }];
  if (!rule) return [];
  const { startMinutes: s, endMinutes: e, breakStartMinutes: bs, breakEndMinutes: be } = rule;
  if (bs != null && be != null && bs > s && be < e && bs < be) {
    return [
      { start: s, end: bs },
      { start: be, end: e },
    ];
  }
  return [{ start: s, end: e }];
}

/** Converte um intervalo UTC para minutos do dia `dateKey`, recortando o que cai fora do dia. */
export function clampToDay(range: UtcRange, dateKey: DateKey, tz: string): MinuteRange | null {
  const startKey = toDateKey(range.startsAt, tz);
  const endKey = toDateKey(range.endsAt, tz);
  if (startKey > dateKey || endKey < dateKey) return null;
  const start = startKey < dateKey ? 0 : toMinutesOfDay(range.startsAt, tz);
  let end = endKey > dateKey ? 24 * 60 : toMinutesOfDay(range.endsAt, tz);
  // endsAt exatamente à meia-noite do dia seguinte conta como fim do dia
  if (endKey > dateKey && end === 0) end = 24 * 60;
  if (end <= start) return null;
  return { start, end };
}

const overlaps = (a: MinuteRange, b: MinuteRange) => a.start < b.end && a.end > b.start;

/**
 * Lista os horários de início possíveis para um serviço em um dia.
 * Regras aplicadas (seção 11 da especificação):
 *  - respeita horário de funcionamento, almoço, folgas e horários excepcionais;
 *  - respeita bloqueios e férias;
 *  - considera a duração do serviço e o tempo mínimo entre agendamentos (buffer);
 *  - respeita antecedência mínima e máxima;
 *  - permite até `maxConcurrent` atendimentos simultâneos;
 *  - respeita o limite diário de atendimentos (`maxDailyAppointments`), se configurado.
 */
export function computeAvailableSlots(input: AvailabilityInput): Slot[] {
  const {
    dateKey, tz, now, durationMinutes, slotIntervalMinutes, bufferMinutes,
    minAdvanceMinutes, maxAdvanceDays, maxConcurrent,
  } = input;

  // Antecedência máxima (em dias de calendário no fuso do tenant)
  const todayKey = toDateKey(now, tz);
  if (dateKey < todayKey) return [];
  const lastKey = toDateKey(new Date(now.getTime() + maxAdvanceDays * 86_400_000), tz);
  if (dateKey > lastKey) return [];

  const windows = openWindows(input.rule, input.exception);
  if (windows.length === 0) return [];

  const blocked = input.blocks.map((b) => clampToDay(b, dateKey, tz)).filter((r): r is MinuteRange => !!r);
  const todays = input.appointments.map((a) => clampToDay(a, dateKey, tz)).filter((r): r is MinuteRange => !!r);
  // Limite diário: atingido = dia fechado para novos agendamentos (ex.: 4 alongamentos por dia).
  const limit = input.maxDailyAppointments;
  if (limit != null && limit > 0 && todays.length >= limit) return [];
  // Buffer: cada agendamento "ocupa" também o tempo mínimo entre atendimentos.
  const busy = todays.map((r) => ({ start: r.start - bufferMinutes, end: r.end + bufferMinutes }));

  const earliestStart = new Date(now.getTime() + minAdvanceMinutes * 60_000);
  const step = Math.max(5, slotIntervalMinutes);
  const slots: Slot[] = [];

  for (const w of windows) {
    for (let m = w.start; m + durationMinutes <= w.end; m += step) {
      const candidate: MinuteRange = { start: m, end: m + durationMinutes };
      if (blocked.some((b) => overlaps(candidate, b))) continue;
      const concurrent = busy.filter((b) => overlaps(candidate, b)).length;
      if (concurrent >= maxConcurrent) continue;
      const startsAt = zonedDateTimeToUtc(dateKey, m, tz);
      if (startsAt < earliestStart) continue;
      slots.push({ minutes: m, startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000) });
    }
  }
  return slots;
}

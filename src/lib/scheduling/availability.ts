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
 * O dia de UM profissional, já reduzido a minutos: janelas abertas, bloqueios e ocupação.
 * É a peça que `computeAvailableSlots` (um serviço) e `computeVisitSlots` (vários) compartilham.
 * `null` = o dia está fechado para novos agendamentos (folga, fora da antecedência, limite diário).
 */
export type ProfessionalDay = {
  windows: MinuteRange[];
  blocked: MinuteRange[];
  busy: MinuteRange[]; // agendamentos já com o buffer aplicado
  maxConcurrent: number;
};

export function buildProfessionalDay(input: Omit<AvailabilityInput, "durationMinutes" | "slotIntervalMinutes" | "minAdvanceMinutes">): ProfessionalDay | null {
  const { dateKey, tz, now, bufferMinutes, maxAdvanceDays, maxConcurrent } = input;

  // Antecedência máxima (em dias de calendário no fuso do tenant)
  const todayKey = toDateKey(now, tz);
  if (dateKey < todayKey) return null;
  const lastKey = toDateKey(new Date(now.getTime() + maxAdvanceDays * 86_400_000), tz);
  if (dateKey > lastKey) return null;

  const windows = openWindows(input.rule, input.exception);
  if (windows.length === 0) return null;

  const blocked = input.blocks.map((b) => clampToDay(b, dateKey, tz)).filter((r): r is MinuteRange => !!r);
  const todays = input.appointments.map((a) => clampToDay(a, dateKey, tz)).filter((r): r is MinuteRange => !!r);
  // Limite diário: atingido = dia fechado para novos agendamentos (ex.: 4 colorações por dia).
  const limit = input.maxDailyAppointments;
  if (limit != null && limit > 0 && todays.length >= limit) return null;
  // Buffer: cada agendamento "ocupa" também o tempo mínimo entre atendimentos.
  const busy = todays.map((r) => ({ start: r.start - bufferMinutes, end: r.end + bufferMinutes }));

  return { windows, blocked, busy, maxConcurrent };
}

/** O intervalo cabe inteiro numa janela do profissional, sem bloqueio e sem estourar a concorrência? */
export function isRangeFree(day: ProfessionalDay, range: MinuteRange): boolean {
  if (!day.windows.some((w) => range.start >= w.start && range.end <= w.end)) return false;
  if (day.blocked.some((b) => overlaps(range, b))) return false;
  return day.busy.filter((b) => overlaps(range, b)).length < day.maxConcurrent;
}

/**
 * Lista os horários de início possíveis para um serviço em um dia.
 * Regras aplicadas (SPEC §9):
 *  - respeita horário de funcionamento, almoço, folgas e horários excepcionais;
 *  - respeita bloqueios e férias;
 *  - considera a duração do serviço e o tempo mínimo entre agendamentos (buffer);
 *  - respeita antecedência mínima e máxima;
 *  - permite até `maxConcurrent` atendimentos simultâneos;
 *  - respeita o limite diário de atendimentos (`maxDailyAppointments`), se configurado.
 */
export function computeAvailableSlots(input: AvailabilityInput): Slot[] {
  const { dateKey, tz, now, durationMinutes, slotIntervalMinutes, minAdvanceMinutes } = input;
  const day = buildProfessionalDay(input);
  if (!day) return [];

  const earliestStart = new Date(now.getTime() + minAdvanceMinutes * 60_000);
  const step = Math.max(5, slotIntervalMinutes);
  const slots: Slot[] = [];

  for (const w of day.windows) {
    for (let m = w.start; m + durationMinutes <= w.end; m += step) {
      if (!isRangeFree(day, { start: m, end: m + durationMinutes })) continue;
      const startsAt = zonedDateTimeToUtc(dateKey, m, tz);
      if (startsAt < earliestStart) continue;
      slots.push({ minutes: m, startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000) });
    }
  }
  return slots;
}

// ───────────────────────── Visita com vários serviços (SPEC §11) ─────────────────────────

/** Um serviço da visita, ainda sem horário: quem pode fazer e quanto tempo leva. */
export type VisitItem = {
  key: string; // identifica o item no resultado (ex.: serviceId ou índice)
  durationMinutes: number; // serviço + adicionais
  candidates: string[]; // profissionais habilitados, em ordem de preferência ("qualquer" = todos os habilitados)
};

/** Onde cada item ficou: profissional escolhido e intervalo em minutos do dia. */
export type ItemPlacement = { key: string; professionalId: string; start: number; end: number };

export type VisitSlot = { minutes: number; startsAt: Date; endsAt: Date; placements: ItemPlacement[] };

/**
 * Tenta encaixar todos os itens de uma visita a partir de `startMinutes`.
 * Devolve a alocação de cada item, ou `null` se a visita não cabe nesse início.
 *
 * `isFree(professionalId, range)` responde se aquele profissional está livre no intervalo
 * (já considera janela, bloqueios, buffer e concorrência — ver `isRangeFree`).
 *
 * Esta função decide a REGRA DE SEQUENCIAMENTO da visita, que o spec deixa em aberto:
 *  - estritamente em sequência (item 2 começa quando o item 1 termina; total = soma das durações,
 *    como no exemplo "2h15" do SPEC §11);
 *  - ou permitindo sobreposição quando os profissionais são diferentes (manicure durante a escova),
 *    o que encurta a visita mas pressupõe que o salão trabalha assim.
 * Também decide como escolher entre os `candidates` de cada item (primeiro livre? menor carga?).
 */
export function placeVisit(
  startMinutes: number,
  items: VisitItem[],
  isFree: (professionalId: string, range: MinuteRange) => boolean,
): ItemPlacement[] | null {
  // Regra do MVP: estritamente em sequência (a cliente faz um serviço de cada vez, na ordem
  // escolhida) e, entre os candidatos, o primeiro que estiver livre. Balanceamento de carga,
  // quando desejado, é feito pela camada de serviço ordenando `candidates` antes.
  const placements: ItemPlacement[] = [];
  let cursor = startMinutes;
  for (const item of items) {
    const range: MinuteRange = { start: cursor, end: cursor + item.durationMinutes };
    const professionalId = item.candidates.find((pid) => isFree(pid, range));
    if (!professionalId) return null;
    placements.push({ key: item.key, professionalId, ...range });
    cursor = range.end;
  }
  return placements;
}

export type VisitAvailabilityInput = {
  dateKey: DateKey;
  tz: string;
  now: Date;
  items: VisitItem[];
  days: Map<string, ProfessionalDay | null>; // por professionalId (null = dia fechado)
  slotIntervalMinutes: number;
  minAdvanceMinutes: number;
};

/**
 * Horários de início em que a visita inteira cabe. Percorre os inícios possíveis
 * (união das janelas de todos os profissionais candidatos) e delega a `placeVisit`.
 */
export function computeVisitSlots(input: VisitAvailabilityInput): VisitSlot[] {
  const { dateKey, tz, now, items, days } = input;
  if (items.length === 0) return [];

  const isFree = (professionalId: string, range: MinuteRange) => {
    const day = days.get(professionalId);
    return !!day && isRangeFree(day, range);
  };

  // Inícios candidatos: começo de cada janela de cada profissional do primeiro item, avançando de `step`.
  const step = Math.max(5, input.slotIntervalMinutes);
  const starts = new Set<number>();
  for (const pid of items[0].candidates) {
    for (const w of days.get(pid)?.windows ?? []) for (let m = w.start; m < w.end; m += step) starts.add(m);
  }

  const earliestStart = new Date(now.getTime() + input.minAdvanceMinutes * 60_000);
  const slots: VisitSlot[] = [];
  for (const m of [...starts].sort((a, b) => a - b)) {
    const startsAt = zonedDateTimeToUtc(dateKey, m, tz);
    if (startsAt < earliestStart) continue;
    const placements = placeVisit(m, items, isFree);
    if (!placements) continue;
    const end = Math.max(...placements.map((p) => p.end));
    slots.push({ minutes: m, startsAt, endsAt: zonedDateTimeToUtc(dateKey, end, tz), placements });
  }
  return slots;
}

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

// ───────────────────── Visita com vários serviços (SPEC §11), salas e recursos ─────────────────────

/** Recurso pedido por um item: qual e quantas unidades. */
export type ResourceNeed = { resourceId: string; quantity: number };

/** Um serviço da visita, ainda sem horário: quem pode fazer, onde, com o quê e quanto tempo leva. */
export type VisitItem = {
  key: string; // identifica o item no resultado (ex.: serviceId ou índice)
  durationMinutes: number; // serviço + adicionais
  candidates: string[]; // profissionais habilitados, em ordem de preferência ("qualquer" = todos os habilitados)
  /**
   * Salas em que o serviço pode acontecer, em ordem de preferência (opção "agenda por sala" do tenant).
   * `undefined`/`null` = o serviço não usa sala; `[]` = precisa de sala mas nenhuma serve (nunca cabe).
   */
  roomCandidates?: string[] | null;
  /** Recursos compartilhados que o serviço consome enquanto acontece (banheira, sauna, maca…). */
  resources?: ResourceNeed[];
  /** Preparo/limpeza: a sala e os recursos ficam ocupados também nesse tempo; o profissional não. */
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
};

/** Onde cada item ficou: profissional, sala (ou null) e intervalo do atendimento em minutos do dia. */
export type ItemPlacement = { key: string; professionalId: string; roomId: string | null; start: number; end: number };

/** O dia de UMA sala: bloqueios (manutenção) e ocupação (itens já com preparo/limpeza aplicados). */
export type RoomDay = { blocked: MinuteRange[]; busy: MinuteRange[] };

/** O dia de UM recurso: quantas unidades existem e o que já está reservado (com quantidade). */
export type ResourceDay = { quantity: number; blocked: MinuteRange[]; reservations: { range: MinuteRange; quantity: number }[] };

const clampAll = (ranges: UtcRange[], dateKey: DateKey, tz: string) => ranges.map((r) => clampToDay(r, dateKey, tz)).filter((r): r is MinuteRange => !!r);

export function buildRoomDay(input: { dateKey: DateKey; tz: string; blocks: UtcRange[]; items: UtcRange[] }): RoomDay {
  return { blocked: clampAll(input.blocks, input.dateKey, input.tz), busy: clampAll(input.items, input.dateKey, input.tz) };
}

export function buildResourceDay(input: { dateKey: DateKey; tz: string; quantity: number; blocks: UtcRange[]; reservations: (UtcRange & { quantity: number })[] }): ResourceDay {
  const reservations: ResourceDay["reservations"] = [];
  for (const r of input.reservations) {
    const range = clampToDay(r, input.dateKey, input.tz);
    if (range) reservations.push({ range, quantity: r.quantity });
  }
  return { quantity: input.quantity, blocked: clampAll(input.blocks, input.dateKey, input.tz), reservations };
}

/** A sala está livre (sem bloqueio e sem outro item) durante todo o intervalo? Sala desconhecida/inativa = ocupada. */
export function isRoomFree(day: RoomDay | undefined, range: MinuteRange): boolean {
  if (!day) return false;
  return !day.blocked.some((b) => overlaps(range, b)) && !day.busy.some((b) => overlaps(range, b));
}

/**
 * Quantas unidades do recurso sobram no pior momento do intervalo (bloqueio = nenhuma).
 * O pico de uso só muda no início de alguma reserva, então basta avaliar nesses instantes.
 */
export function resourceUnitsFree(day: ResourceDay | undefined, range: MinuteRange): number {
  if (!day) return 0;
  if (day.blocked.some((b) => overlaps(range, b))) return 0;
  const instantes = new Set<number>([range.start]);
  for (const r of day.reservations) if (overlaps(range, r.range)) instantes.add(Math.max(r.range.start, range.start));
  let pico = 0;
  for (const t of instantes) pico = Math.max(pico, day.reservations.filter((r) => r.range.start <= t && r.range.end > t).reduce((n, r) => n + r.quantity, 0));
  return Math.max(0, day.quantity - pico);
}

/** Como o motor consulta o mundo ao encaixar uma visita. Tudo já reduzido a minutos do dia. */
export type PlacementContext = {
  isProfessionalFree: (professionalId: string, range: MinuteRange) => boolean;
  isRoomFree: (roomId: string, range: MinuteRange) => boolean;
  resourceUnitsFree: (resourceId: string, range: MinuteRange) => number;
};

/**
 * REGRA DE ESCOLHA DA SALA (decisão de negócio, isolada de propósito): a primeira livre na ordem
 * cadastrada pelo estabelecimento (sortOrder). Previsível — "Sala 01" enche antes da "Sala 02" e a
 * recepção sabe onde olhar. Alternativas futuras por tenant: a menos usada no dia, a menor que sirva
 * (preserva a sala de casal), a que o cliente usou da última vez.
 */
export function pickRoom(candidates: string[], range: MinuteRange, ctx: PlacementContext): string | null {
  return candidates.find((roomId) => ctx.isRoomFree(roomId, range)) ?? null;
}

/** Intervalo que a sala e os recursos ocupam: o atendimento mais o preparo/limpeza. */
export function occupiedRange(core: MinuteRange, item: Pick<VisitItem, "bufferBeforeMinutes" | "bufferAfterMinutes">): MinuteRange {
  return { start: core.start - (item.bufferBeforeMinutes ?? 0), end: core.end + (item.bufferAfterMinutes ?? 0) };
}

export type VisitSlot = { minutes: number; startsAt: Date; endsAt: Date; placements: ItemPlacement[] };

/**
 * Tenta encaixar todos os itens de uma visita a partir de `startMinutes`.
 * Devolve a alocação de cada item, ou `null` se a visita não cabe nesse início.
 *
 * Um item só cabe quando, ao mesmo tempo:
 *  - um profissional candidato está livre no intervalo do atendimento (`isRangeFree`: janela, bloqueios, buffer, concorrência);
 *  - uma sala candidata está livre no intervalo com preparo/limpeza (se o serviço usa sala);
 *  - cada recurso pedido tem unidades suficientes nesse mesmo intervalo.
 *
 * Regra de sequenciamento: estritamente em sequência — item N começa quando N−1 termina; total = soma
 * das durações (o "2h15" do SPEC §11). Entre candidatos, o primeiro livre; balanceamento de carga é feito
 * pela camada de serviço reordenando `candidates`. Como os itens da mesma visita nunca se sobrepõem, a
 * mesma sala/recurso pode se repetir de um item para o outro sem conflito.
 */
export function placeVisit(startMinutes: number, items: VisitItem[], ctx: PlacementContext): ItemPlacement[] | null {
  const placements: ItemPlacement[] = [];
  let cursor = startMinutes;
  for (const item of items) {
    const core: MinuteRange = { start: cursor, end: cursor + item.durationMinutes };
    const professionalId = item.candidates.find((pid) => ctx.isProfessionalFree(pid, core));
    if (!professionalId) return null;
    const occupied = occupiedRange(core, item);
    let roomId: string | null = null;
    if (item.roomCandidates != null) {
      roomId = pickRoom(item.roomCandidates, occupied, ctx);
      if (!roomId) return null;
    }
    for (const need of item.resources ?? []) if (ctx.resourceUnitsFree(need.resourceId, occupied) < need.quantity) return null;
    placements.push({ key: item.key, professionalId, roomId, ...core });
    cursor = core.end;
  }
  return placements;
}

export type VisitAvailabilityInput = {
  dateKey: DateKey;
  tz: string;
  now: Date;
  items: VisitItem[];
  days: Map<string, ProfessionalDay | null>; // por professionalId (null = dia fechado)
  rooms?: Map<string, RoomDay>; // por roomId (ausente = sala indisponível)
  resources?: Map<string, ResourceDay>; // por resourceId
  slotIntervalMinutes: number;
  minAdvanceMinutes: number;
};

/** Monta o `PlacementContext` a partir dos mapas por dia. */
export function contextFromDays(input: Pick<VisitAvailabilityInput, "days" | "rooms" | "resources">): PlacementContext {
  return {
    isProfessionalFree: (pid, range) => { const day = input.days.get(pid); return !!day && isRangeFree(day, range); },
    isRoomFree: (roomId, range) => isRoomFree(input.rooms?.get(roomId), range),
    resourceUnitsFree: (resourceId, range) => resourceUnitsFree(input.resources?.get(resourceId), range),
  };
}

/**
 * Horários de início em que a visita inteira cabe (profissionais, salas e recursos). Percorre os inícios possíveis
 * (união das janelas de todos os profissionais candidatos) e delega a `placeVisit`.
 */
export function computeVisitSlots(input: VisitAvailabilityInput): VisitSlot[] {
  const { dateKey, tz, now, items, days } = input;
  if (items.length === 0) return [];
  const ctx = contextFromDays(input);

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
    const placements = placeVisit(m, items, ctx);
    if (!placements) continue;
    const end = Math.max(...placements.map((p) => p.end));
    slots.push({ minutes: m, startsAt, endsAt: zonedDateTimeToUtc(dateKey, end, tz), placements });
  }
  return slots;
}

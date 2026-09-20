import "server-only";
import { db } from "@/lib/db";
import type { Tenant } from "@/generated/prisma/client";
import { addDaysToKey, dateKeyToDate, weekdayOfKey, zonedDateTimeToUtc, type DateKey } from "@/lib/dates";
import {
  buildProfessionalDay, buildResourceDay, buildRoomDay, computeAvailableSlots, computeVisitSlots,
  type DayException, type ProfessionalDay, type ResourceDay, type RoomDay, type Slot, type UtcRange, type VisitItem, type VisitSlot, type WeeklyRule,
} from "./availability";

/** Status que ocupam horário na agenda. */
export const ACTIVE_STATUSES = ["PENDING", "AWAITING_PAYMENT", "AWAITING_CONFIRMATION", "CONFIRMED"] as const;

type TenantRules = Pick<
  Tenant,
  | "timezone" | "slotIntervalMinutes" | "bufferMinutes" | "minAdvanceMinutes"
  | "maxAdvanceDays" | "maxConcurrentAppointments" | "maxDailyAppointments"
>;

/**
 * Carrega, de uma vez, tudo que é necessário para calcular disponibilidade
 * em um intervalo de dias [fromKey, toKey] de um profissional.
 */
async function loadContext(professionalId: string, tz: string, fromKey: DateKey, toKey: DateKey, excludeAppointmentId?: string) {
  const rangeStart = zonedDateTimeToUtc(fromKey, 0, tz);
  const rangeEnd = zonedDateTimeToUtc(addDaysToKey(toKey, 1), 0, tz);

  const [rules, exceptions, blocks, appointments] = await Promise.all([
    db.availabilityRule.findMany({ where: { professionalId } }),
    db.scheduleException.findMany({
      where: { professionalId, date: { gte: dateKeyToDate(fromKey), lte: dateKeyToDate(toKey) } },
    }),
    db.scheduleBlock.findMany({
      where: { professionalId, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
      select: { startsAt: true, endsAt: true },
    }),
    // O que ocupa a agenda do profissional são os ITENS das visitas ativas (SPEC §11).
    db.appointmentItem.findMany({
      where: {
        professionalId,
        appointment: { status: { in: [...ACTIVE_STATUSES] } },
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        ...(excludeAppointmentId ? { appointmentId: { not: excludeAppointmentId } } : {}),
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const ruleByWeekday = new Map<number, WeeklyRule>(rules.map((r) => [r.weekday, r]));
  const exceptionByKey = new Map<DateKey, DayException>();
  for (const ex of exceptions) {
    const key = ex.date.toISOString().slice(0, 10);
    exceptionByKey.set(
      key,
      ex.kind === "CLOSED"
        ? { kind: "CLOSED" }
        : { kind: "CUSTOM_HOURS", startMinutes: ex.startMinutes ?? 0, endMinutes: ex.endMinutes ?? 0 },
    );
  }
  return { ruleByWeekday, exceptionByKey, blocks, appointments };
}

export async function getAvailableSlots(opts: {
  tenant: TenantRules;
  professionalId: string;
  dateKey: DateKey;
  durationMinutes: number;
  now?: Date;
  excludeAppointmentId?: string; // usado em reagendamento
}): Promise<Slot[]> {
  const { tenant, professionalId, dateKey, durationMinutes } = opts;
  const ctx = await loadContext(professionalId, tenant.timezone, dateKey, dateKey, opts.excludeAppointmentId);
  return computeAvailableSlots({
    dateKey,
    tz: tenant.timezone,
    now: opts.now ?? new Date(),
    rule: ctx.ruleByWeekday.get(weekdayOfKey(dateKey)) ?? null,
    exception: ctx.exceptionByKey.get(dateKey) ?? null,
    blocks: ctx.blocks,
    appointments: ctx.appointments,
    durationMinutes,
    slotIntervalMinutes: tenant.slotIntervalMinutes,
    bufferMinutes: tenant.bufferMinutes,
    minAdvanceMinutes: tenant.minAdvanceMinutes,
    maxAdvanceDays: tenant.maxAdvanceDays,
    maxConcurrent: tenant.maxConcurrentAppointments,
    maxDailyAppointments: tenant.maxDailyAppointments,
  });
}

/** Para o calendário público: quais dias do intervalo têm ao menos um horário. */
export async function getDaysWithAvailability(opts: {
  tenant: TenantRules;
  professionalId: string;
  fromKey: DateKey;
  toKey: DateKey;
  durationMinutes: number;
}): Promise<Set<DateKey>> {
  const { tenant, professionalId, fromKey, toKey, durationMinutes } = opts;
  const ctx = await loadContext(professionalId, tenant.timezone, fromKey, toKey);
  const now = new Date();
  const result = new Set<DateKey>();
  for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) {
    const slots = computeAvailableSlots({
      dateKey: key,
      tz: tenant.timezone,
      now,
      rule: ctx.ruleByWeekday.get(weekdayOfKey(key)) ?? null,
      exception: ctx.exceptionByKey.get(key) ?? null,
      blocks: ctx.blocks,
      appointments: ctx.appointments,
      durationMinutes,
      slotIntervalMinutes: tenant.slotIntervalMinutes,
      bufferMinutes: tenant.bufferMinutes,
      minAdvanceMinutes: tenant.minAdvanceMinutes,
      maxAdvanceDays: tenant.maxAdvanceDays,
      maxConcurrent: tenant.maxConcurrentAppointments,
    });
    if (slots.length > 0) result.add(key);
  }
  return result;
}

export type AssignedSlot = Slot & { professionalId: string };

/**
 * União dos horários de vários profissionais ("Qualquer profissional").
 * Para cada horário, atribui o profissional com menos agendamentos no dia
 * (balanceia a carga da equipe); empate → ordem da lista.
 */
export async function getAvailableSlotsAny(opts: {
  tenant: TenantRules;
  professionalIds: string[];
  dateKey: DateKey;
  durationMinutes: number;
  now?: Date;
}): Promise<AssignedSlot[]> {
  const { tenant, professionalIds, dateKey, durationMinutes } = opts;
  const now = opts.now ?? new Date();
  const perPro = await Promise.all(
    professionalIds.map(async (professionalId) => {
      const slots = await getAvailableSlots({ tenant, professionalId, dateKey, durationMinutes, now });
      const load = await countDailyLoad(professionalId, dateKey, tenant.timezone);
      return { professionalId, slots, load };
    }),
  );
  perPro.sort((a, b) => a.load - b.load);

  const byMinute = new Map<number, AssignedSlot>();
  for (const { professionalId, slots } of perPro) {
    for (const s of slots) if (!byMinute.has(s.minutes)) byMinute.set(s.minutes, { ...s, professionalId });
  }
  return [...byMinute.values()].sort((a, b) => a.minutes - b.minutes);
}

export async function getDaysWithAvailabilityAny(opts: {
  tenant: TenantRules;
  professionalIds: string[];
  fromKey: DateKey;
  toKey: DateKey;
  durationMinutes: number;
}): Promise<Set<DateKey>> {
  const sets = await Promise.all(opts.professionalIds.map((professionalId) => getDaysWithAvailability({ ...opts, professionalId })));
  return new Set(sets.flatMap((s) => [...s]));
}

/** Quantos itens ativos o profissional já tem no dia (para balancear "qualquer profissional"). */
async function countDailyLoad(professionalId: string, dateKey: DateKey, tz: string): Promise<number> {
  return db.appointmentItem.count({
    where: {
      professionalId,
      appointment: { status: { in: [...ACTIVE_STATUSES] } },
      startsAt: { gte: zonedDateTimeToUtc(dateKey, 0, tz), lt: zonedDateTimeToUtc(addDaysToKey(dateKey, 1), 0, tz) },
    },
  });
}

// ───────────────────── Visita com vários serviços (SPEC §11), salas e recursos ─────────────────────

/** Intervalo que um item ocupa na sala/recurso: atendimento + preparo/limpeza. */
export function occupiedUtc(it: { startsAt: Date; endsAt: Date; bufferBeforeMinutes: number; bufferAfterMinutes: number }): UtcRange {
  return { startsAt: new Date(it.startsAt.getTime() - it.bufferBeforeMinutes * 60_000), endsAt: new Date(it.endsAt.getTime() + it.bufferAfterMinutes * 60_000) };
}

/** Bloqueios e ocupação das salas citadas nos itens, em [fromKey, toKey]. Sala inativa/inexistente fica fora do mapa (= indisponível). */
async function loadRoomsContext(roomIds: string[], tz: string, fromKey: DateKey, toKey: DateKey, excludeAppointmentId?: string) {
  const ctx = new Map<string, { blocks: UtcRange[]; items: UtcRange[] }>();
  if (roomIds.length === 0) return ctx;
  const rangeStart = zonedDateTimeToUtc(fromKey, 0, tz);
  const rangeEnd = zonedDateTimeToUtc(addDaysToKey(toKey, 1), 0, tz);
  const [rooms, blocks, items] = await Promise.all([
    db.room.findMany({ where: { id: { in: roomIds }, active: true }, select: { id: true } }),
    db.scheduleBlock.findMany({ where: { roomId: { in: roomIds }, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } }, select: { roomId: true, startsAt: true, endsAt: true } }),
    db.appointmentItem.findMany({
      where: { roomId: { in: roomIds }, appointment: { status: { in: [...ACTIVE_STATUSES] } }, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart }, ...(excludeAppointmentId ? { appointmentId: { not: excludeAppointmentId } } : {}) },
      select: { roomId: true, startsAt: true, endsAt: true, bufferBeforeMinutes: true, bufferAfterMinutes: true },
    }),
  ]);
  for (const r of rooms) ctx.set(r.id, { blocks: [], items: [] });
  for (const b of blocks) ctx.get(b.roomId!)?.blocks.push(b);
  for (const it of items) ctx.get(it.roomId!)?.items.push(occupiedUtc(it));
  return ctx;
}

/** Quantidade, bloqueios e reservas dos recursos citados nos itens, em [fromKey, toKey]. */
async function loadResourcesContext(resourceIds: string[], tz: string, fromKey: DateKey, toKey: DateKey, excludeAppointmentId?: string) {
  const ctx = new Map<string, { quantity: number; blocks: UtcRange[]; reservations: (UtcRange & { quantity: number })[] }>();
  if (resourceIds.length === 0) return ctx;
  const rangeStart = zonedDateTimeToUtc(fromKey, 0, tz);
  const rangeEnd = zonedDateTimeToUtc(addDaysToKey(toKey, 1), 0, tz);
  const [resources, blocks, reservations] = await Promise.all([
    db.resource.findMany({ where: { id: { in: resourceIds }, active: true }, select: { id: true, quantity: true } }),
    db.scheduleBlock.findMany({ where: { resourceId: { in: resourceIds }, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } }, select: { resourceId: true, startsAt: true, endsAt: true } }),
    db.appointmentItemResource.findMany({
      where: { resourceId: { in: resourceIds }, item: { appointment: { status: { in: [...ACTIVE_STATUSES] } }, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart }, ...(excludeAppointmentId ? { appointmentId: { not: excludeAppointmentId } } : {}) } },
      select: { resourceId: true, quantity: true, item: { select: { startsAt: true, endsAt: true, bufferBeforeMinutes: true, bufferAfterMinutes: true } } },
    }),
  ]);
  for (const r of resources) ctx.set(r.id, { quantity: r.quantity, blocks: [], reservations: [] });
  for (const b of blocks) ctx.get(b.resourceId!)?.blocks.push(b);
  for (const r of reservations) ctx.get(r.resourceId)?.reservations.push({ ...occupiedUtc(r.item), quantity: r.quantity });
  return ctx;
}

/**
 * Carrega o dia de cada profissional, sala e recurso citado nos itens, de uma vez, para o intervalo
 * [fromKey, toKey]. Devolve um construtor por data, para reuso no calendário (vários dias) sem repetir
 * as consultas.
 */
async function loadVisitContext(opts: {
  tenant: TenantRules;
  items: VisitItem[];
  fromKey: DateKey;
  toKey: DateKey;
  now: Date;
  excludeAppointmentId?: string;
}) {
  const { tenant, items, fromKey, toKey, now } = opts;
  const tz = tenant.timezone;
  const professionalIds = [...new Set(items.flatMap((i) => i.candidates))];
  const roomIds = [...new Set(items.flatMap((i) => i.roomCandidates ?? []))];
  const resourceIds = [...new Set(items.flatMap((i) => (i.resources ?? []).map((r) => r.resourceId)))];
  const [contexts, roomsCtx, resourcesCtx] = await Promise.all([
    Promise.all(professionalIds.map(async (pid) => [pid, await loadContext(pid, tz, fromKey, toKey, opts.excludeAppointmentId)] as const)),
    loadRoomsContext(roomIds, tz, fromKey, toKey, opts.excludeAppointmentId),
    loadResourcesContext(resourceIds, tz, fromKey, toKey, opts.excludeAppointmentId),
  ]);
  return (dateKey: DateKey) => {
    const days = new Map<string, ProfessionalDay | null>();
    for (const [pid, ctx] of contexts) {
      days.set(pid, buildProfessionalDay({
        dateKey, tz: tenant.timezone, now,
        rule: ctx.ruleByWeekday.get(weekdayOfKey(dateKey)) ?? null,
        exception: ctx.exceptionByKey.get(dateKey) ?? null,
        blocks: ctx.blocks,
        appointments: ctx.appointments,
        bufferMinutes: tenant.bufferMinutes,
        maxAdvanceDays: tenant.maxAdvanceDays,
        maxConcurrent: tenant.maxConcurrentAppointments,
        maxDailyAppointments: tenant.maxDailyAppointments,
      }));
    }
    const rooms = new Map<string, RoomDay>();
    for (const [id, c] of roomsCtx) rooms.set(id, buildRoomDay({ dateKey, tz, blocks: c.blocks, items: c.items }));
    const resources = new Map<string, ResourceDay>();
    for (const [id, c] of resourcesCtx) resources.set(id, buildResourceDay({ dateKey, tz, quantity: c.quantity, blocks: c.blocks, reservations: c.reservations }));
    return { days, rooms, resources };
  };
}

/**
 * Ordena os candidatos de cada item pela carga do dia (menor primeiro), mantendo a ordem
 * original como desempate. `placeVisit` pega o primeiro livre, então isso distribui a equipe.
 */
async function balanceCandidates(items: VisitItem[], dateKey: DateKey, tz: string): Promise<VisitItem[]> {
  const ids = [...new Set(items.flatMap((i) => i.candidates))];
  const load = new Map(await Promise.all(ids.map(async (pid) => [pid, await countDailyLoad(pid, dateKey, tz)] as const)));
  return items.map((item) =>
    item.candidates.length <= 1
      ? item
      : { ...item, candidates: [...item.candidates].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0)) },
  );
}

/** Horários em que a visita inteira (todos os itens, em sequência, com sala e recursos) cabe no dia. */
export async function getVisitSlots(opts: {
  tenant: TenantRules;
  items: VisitItem[];
  dateKey: DateKey;
  now?: Date;
  excludeAppointmentId?: string; // reagendamento: ignora os itens da própria visita
}): Promise<VisitSlot[]> {
  const { tenant, dateKey } = opts;
  const now = opts.now ?? new Date();
  const items = await balanceCandidates(opts.items, dateKey, tenant.timezone);
  const daysFor = await loadVisitContext({ tenant, items, fromKey: dateKey, toKey: dateKey, now, excludeAppointmentId: opts.excludeAppointmentId });
  return computeVisitSlots({
    dateKey, tz: tenant.timezone, now, items, ...daysFor(dateKey),
    slotIntervalMinutes: tenant.slotIntervalMinutes,
    minAdvanceMinutes: tenant.minAdvanceMinutes,
  });
}

/** Para o calendário público: dias do intervalo em que a visita cabe ao menos uma vez. */
export async function getDaysWithVisitAvailability(opts: {
  tenant: TenantRules;
  items: VisitItem[];
  fromKey: DateKey;
  toKey: DateKey;
}): Promise<Set<DateKey>> {
  const { tenant, items, fromKey, toKey } = opts;
  const now = new Date();
  const daysFor = await loadVisitContext({ tenant, items, fromKey, toKey, now });
  const result = new Set<DateKey>();
  for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) {
    const slots = computeVisitSlots({
      dateKey: key, tz: tenant.timezone, now, items, ...daysFor(key),
      slotIntervalMinutes: tenant.slotIntervalMinutes,
      minAdvanceMinutes: tenant.minAdvanceMinutes,
    });
    if (slots.length > 0) result.add(key);
  }
  return result;
}

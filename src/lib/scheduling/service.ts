import "server-only";
import { db } from "@/lib/db";
import type { Tenant } from "@/generated/prisma/client";
import { addDaysToKey, dateKeyToDate, weekdayOfKey, zonedDateTimeToUtc, type DateKey } from "@/lib/dates";
import { computeAvailableSlots, type DayException, type Slot, type WeeklyRule } from "./availability";

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
    db.appointment.findMany({
      where: {
        professionalId,
        status: { in: [...ACTIVE_STATUSES] },
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
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
      const load = await db.appointment.count({
        where: {
          professionalId,
          status: { in: [...ACTIVE_STATUSES] },
          startsAt: { gte: zonedDateTimeToUtc(dateKey, 0, tenant.timezone), lt: zonedDateTimeToUtc(addDaysToKey(dateKey, 1), 0, tenant.timezone) },
        },
      });
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

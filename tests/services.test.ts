import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeAvailableSlots, type AvailabilityInput } from "../src/lib/scheduling/availability";
import { zonedDateTimeToUtc, minutesToHHMM } from "../src/lib/dates";
import { computeBookingTotals, describeBooking, normalizeAddOnIds } from "../src/lib/services/addons";
import { averageIntervalDays, isRecurring, maintenanceStatus } from "../src/lib/clients/insights";
import { hasPolicies, policyItems } from "../src/lib/policies";

const TZ = "America/Sao_Paulo";
const DAY = "2026-09-22"; // terça-feira

const base: AvailabilityInput = {
  dateKey: DAY,
  tz: TZ,
  now: zonedDateTimeToUtc("2026-09-21", 12 * 60, TZ),
  rule: { startMinutes: 9 * 60, endMinutes: 18 * 60, breakStartMinutes: null, breakEndMinutes: null },
  exception: null,
  blocks: [],
  appointments: [],
  durationMinutes: 150, // alongamento em fibra: 2h30
  slotIntervalMinutes: 30,
  bufferMinutes: 0,
  minAdvanceMinutes: 60,
  maxAdvanceDays: 60,
  maxConcurrent: 1,
};
const times = (input: AvailabilityInput) => computeAvailableSlots(input).map((s) => minutesToHHMM(s.minutes));
const range = (start: number, end: number) => ({ startsAt: zonedDateTimeToUtc(DAY, start, TZ), endsAt: zonedDateTimeToUtc(DAY, end, TZ) });

describe("adicionais (seção 6.3)", () => {
  const fibra = { durationMinutes: 150, priceCents: 22000 };
  const nailArt = { durationMinutes: 20, priceCents: 2500 };
  const francesinha = { durationMinutes: 15, priceCents: 1500 };

  it("somam tempo e preço ao procedimento principal", () => {
    const t = computeBookingTotals(fibra, [nailArt, francesinha]);
    assert.equal(t.durationMinutes, 185);
    assert.equal(t.priceCents, 26000);
    assert.equal(t.extraMinutes, 35);
    assert.equal(t.extraCents, 4000);
  });

  it("sem adicionais, totais = procedimento", () => {
    assert.deepEqual(computeBookingTotals(fibra, []), { durationMinutes: 150, priceCents: 22000, extraMinutes: 0, extraCents: 0 });
  });

  it("descrevem o agendamento na agenda", () => {
    assert.equal(describeBooking("Alongamento em fibra", ["Nail art", "Francesinha"]), "Alongamento em fibra + Nail art, Francesinha");
    assert.equal(describeBooking("Manicure", []), "Manicure");
  });

  it("ids são deduplicados e limitados", () => {
    assert.deepEqual(normalizeAddOnIds(["a", "a", " b ", ""]), ["a", "b"]);
    assert.equal(normalizeAddOnIds(Array.from({ length: 20 }, (_, i) => `id${i}`)).length, 10);
    assert.deepEqual(normalizeAddOnIds(undefined), []);
  });

  it("a duração total é o que define os horários possíveis", () => {
    // Fibra (2h30) cabe até 15:30; com nail art (+20) e francesinha (+15) = 3h05, só cabe até 14:30
    assert.ok(times(base).includes("15:30"));
    const withAddOns = times({ ...base, durationMinutes: computeBookingTotals(fibra, [nailArt, francesinha]).durationMinutes });
    assert.ok(!withAddOns.includes("15:30") && !withAddOns.includes("15:00"));
    assert.ok(withAddOns.includes("14:30"));
  });
});

describe("limite diário de atendimentos (seção 4)", () => {
  it("sem limite, o dia segue aberto", () => {
    assert.ok(times({ ...base, maxDailyAppointments: null, appointments: [range(9 * 60, 11 * 60 + 30)] }).length > 0);
  });
  it("ao atingir o limite, nenhum horário é oferecido", () => {
    const two = [range(9 * 60, 11 * 60 + 30), range(12 * 60, 14 * 60 + 30)];
    assert.ok(times({ ...base, maxDailyAppointments: 3, appointments: two }).length > 0);
    assert.deepEqual(times({ ...base, maxDailyAppointments: 2, appointments: two }), []);
  });
  it("agendamentos de outro dia não contam", () => {
    const other = { startsAt: zonedDateTimeToUtc("2026-09-23", 9 * 60, TZ), endsAt: zonedDateTimeToUtc("2026-09-23", 11 * 60, TZ) };
    assert.ok(times({ ...base, maxDailyAppointments: 1, appointments: [other] }).length > 0);
  });
});

describe("relacionamento com a cliente (seção 11)", () => {
  const d = (daysAgo: number) => new Date(Date.UTC(2026, 8, 21) - daysAgo * 86_400_000);
  const now = d(0);

  it("frequência média entre atendimentos", () => {
    assert.equal(averageIntervalDays([d(60), d(40), d(20)]), 20);
    assert.equal(averageIntervalDays([d(10)]), null);
  });

  it("recorrente = 2+ atendimentos nos últimos 90 dias", () => {
    assert.equal(isRecurring([d(60), d(20)], now), true);
    assert.equal(isRecurring([d(120), d(20)], now), false);
    assert.equal(isRecurring([d(20)], now), false);
  });

  it("manutenção usa o ciclo da ficha, ou a média observada", () => {
    const due = maintenanceStatus({ lastCompletedAt: d(25), intervalDays: 20, observedIntervalDays: null, hasUpcoming: false, now });
    assert.equal(due.kind, "due");
    if (due.kind === "due") assert.equal(due.daysOverdue, 5);

    const ok = maintenanceStatus({ lastCompletedAt: d(10), intervalDays: null, observedIntervalDays: 21, hasUpcoming: false, now });
    assert.equal(ok.kind, "ok");
    if (ok.kind === "ok") assert.equal(ok.daysLeft, 11);
  });

  it("com horário futuro marcado ou sem histórico, não há o que cobrar", () => {
    assert.equal(maintenanceStatus({ lastCompletedAt: d(40), intervalDays: 20, observedIntervalDays: null, hasUpcoming: true, now }).kind, "unknown");
    assert.equal(maintenanceStatus({ lastCompletedAt: null, intervalDays: 20, observedIntervalDays: null, hasUpcoming: false, now }).kind, "unknown");
    assert.equal(maintenanceStatus({ lastCompletedAt: d(40), intervalDays: null, observedIntervalDays: null, hasUpcoming: false, now }).kind, "unknown");
  });
});

describe("políticas de atendimento (seção 14)", () => {
  const none = { lateToleranceMinutes: 0, cancellationPolicy: null, noShowPolicy: null, reschedulePolicy: null, companionsAllowed: true, preServiceInstructions: null, cancelDeadlineHours: 0 };

  it("sem nada configurado só resta o texto padrão de cancelamento e não exige aceite", () => {
    assert.equal(hasPolicies(none), false);
    assert.equal(policyItems(none).length, 1);
  });

  it("tolerância, acompanhantes e orientações viram itens", () => {
    const t = { ...none, lateToleranceMinutes: 10, companionsAllowed: false, preServiceInstructions: "Venha sem esmalte." };
    assert.equal(hasPolicies(t), true);
    const titles = policyItems(t).map((p) => p.title);
    assert.deepEqual(titles, ["Tolerância de atraso", "Cancelamento", "Acompanhantes", "Antes do atendimento"]);
    assert.match(policyItems(t)[0].text, /10 minutos/);
  });

  it("texto de cancelamento personalizado substitui o padrão", () => {
    const t = { ...none, cancelDeadlineHours: 24, cancellationPolicy: "Sinal retido com menos de 24h." };
    assert.equal(policyItems(t).find((p) => p.title === "Cancelamento")?.text, "Sinal retido com menos de 24h.");
    assert.match(policyItems({ ...none, cancelDeadlineHours: 24 }).find((p) => p.title === "Cancelamento")!.text, /24h/);
  });
});

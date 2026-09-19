import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeAvailableSlots, openWindows, clampToDay, type AvailabilityInput } from "../src/lib/scheduling/availability";
import { zonedDateTimeToUtc, minutesToHHMM } from "../src/lib/dates";

const TZ = "America/Sao_Paulo";
const DAY = "2026-09-21"; // segunda-feira

const base: AvailabilityInput = {
  dateKey: DAY,
  tz: TZ,
  now: zonedDateTimeToUtc("2026-09-20", 12 * 60, TZ), // véspera ao meio-dia
  rule: { startMinutes: 9 * 60, endMinutes: 18 * 60, breakStartMinutes: 12 * 60, breakEndMinutes: 13 * 60 },
  exception: null,
  blocks: [],
  appointments: [],
  durationMinutes: 30,
  slotIntervalMinutes: 30,
  bufferMinutes: 0,
  minAdvanceMinutes: 60,
  maxAdvanceDays: 60,
  maxConcurrent: 1,
};

const times = (input: AvailabilityInput) => computeAvailableSlots(input).map((s) => minutesToHHMM(s.minutes));
const range = (start: number, end: number) => ({ startsAt: zonedDateTimeToUtc(DAY, start, TZ), endsAt: zonedDateTimeToUtc(DAY, end, TZ) });

describe("openWindows", () => {
  it("divide o dia no almoço", () => {
    assert.deepEqual(openWindows(base.rule, null), [{ start: 540, end: 720 }, { start: 780, end: 1080 }]);
  });
  it("folga fecha o dia; horário especial substitui a regra", () => {
    assert.deepEqual(openWindows(base.rule, { kind: "CLOSED" }), []);
    assert.deepEqual(openWindows(base.rule, { kind: "CUSTOM_HOURS", startMinutes: 600, endMinutes: 840 }), [{ start: 600, end: 840 }]);
  });
});

describe("computeAvailableSlots", () => {
  it("gera horários respeitando funcionamento e almoço", () => {
    assert.deepEqual(times(base), [
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
      "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    ]);
  });

  it("serviço de 60 min não cabe nos últimos 30 min antes do almoço/fechamento", () => {
    const t = times({ ...base, durationMinutes: 60 });
    assert.ok(!t.includes("11:30"));
    assert.ok(!t.includes("17:30"));
    assert.ok(t.includes("11:00") && t.includes("17:00"));
  });

  it("remove conflitos com agendamentos existentes considerando a duração", () => {
    const t = times({ ...base, appointments: [range(10 * 60, 11 * 60)] });
    assert.ok(!t.includes("10:00") && !t.includes("10:30"));
    assert.ok(t.includes("09:30") && t.includes("11:00"));
  });

  it("aplica o tempo mínimo entre agendamentos (buffer)", () => {
    const t = times({ ...base, bufferMinutes: 15, slotIntervalMinutes: 15, appointments: [range(10 * 60, 10 * 60 + 30)] });
    assert.ok(!t.includes("09:45"), "09:45–10:15 encosta no buffer antes das 10:00");
    assert.ok(!t.includes("10:30"), "10:30 está dentro do buffer de 15 min após 10:30");
    assert.ok(t.includes("10:45"));
  });

  it("permite atendimentos simultâneos até o limite", () => {
    const busy = [range(10 * 60, 10 * 60 + 30)];
    assert.ok(!times({ ...base, appointments: busy }).includes("10:00"));
    assert.ok(times({ ...base, appointments: busy, maxConcurrent: 2 }).includes("10:00"));
  });

  it("respeita bloqueios, inclusive os que cruzam dias", () => {
    const vacation = { startsAt: zonedDateTimeToUtc("2026-09-20", 0, TZ), endsAt: zonedDateTimeToUtc("2026-09-21", 13 * 60, TZ) };
    const t = times({ ...base, blocks: [vacation] });
    assert.equal(t[0], "13:00");
  });

  it("respeita antecedência mínima e máxima", () => {
    const now = zonedDateTimeToUtc(DAY, 9 * 60 + 50, TZ); // 09:50 do próprio dia, mínimo 60 min
    assert.equal(times({ ...base, now })[0], "11:00");
    assert.deepEqual(times({ ...base, maxAdvanceDays: 0 }), []);
    assert.deepEqual(times({ ...base, dateKey: "2026-09-19" }), [], "dia no passado");
  });

  it("dia fechado por folga não tem horários", () => {
    assert.deepEqual(times({ ...base, exception: { kind: "CLOSED" } }), []);
  });
});

describe("clampToDay", () => {
  it("recorta intervalo que termina à meia-noite do dia seguinte como fim do dia", () => {
    const r = clampToDay({ startsAt: zonedDateTimeToUtc(DAY, 20 * 60, TZ), endsAt: zonedDateTimeToUtc("2026-09-22", 0, TZ) }, DAY, TZ);
    assert.deepEqual(r, { start: 1200, end: 1440 });
  });
  it("retorna null quando o intervalo não toca o dia", () => {
    assert.equal(clampToDay(range(600, 660), "2026-09-22", TZ), null);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProfessionalDay, computeVisitSlots, isRangeFree,
  type ProfessionalDay, type VisitItem, type VisitSlot,
} from "../src/lib/scheduling/availability";
import { zonedDateTimeToUtc, minutesToHHMM } from "../src/lib/dates";

const TZ = "America/Sao_Paulo";
const DAY = "2026-09-21"; // segunda-feira
const NOW = zonedDateTimeToUtc("2026-09-20", 12 * 60, TZ);
const H = (h: number, m = 0) => h * 60 + m;
const range = (start: number, end: number) => ({ startsAt: zonedDateTimeToUtc(DAY, start, TZ), endsAt: zonedDateTimeToUtc(DAY, end, TZ) });

/** Dia 09:00–18:00 sem almoço, com os agendamentos informados. */
function day(appointments: { startsAt: Date; endsAt: Date }[] = [], extra: Partial<Parameters<typeof buildProfessionalDay>[0]> = {}): ProfessionalDay {
  const d = buildProfessionalDay({
    dateKey: DAY, tz: TZ, now: NOW,
    rule: { startMinutes: H(9), endMinutes: H(18), breakStartMinutes: null, breakEndMinutes: null },
    exception: null, blocks: [], appointments,
    bufferMinutes: 0, maxAdvanceDays: 60, maxConcurrent: 1, ...extra,
  });
  assert.ok(d, "dia deveria estar aberto");
  return d;
}

// SPEC §11: Corte (Ana) + Escova (Ana) + Manicure (Mariana) = 2h15 no total
const CORTE: VisitItem = { key: "corte", durationMinutes: 45, candidates: ["ana"] };
const ESCOVA: VisitItem = { key: "escova", durationMinutes: 40, candidates: ["ana"] };
const MANICURE: VisitItem = { key: "manicure", durationMinutes: 50, candidates: ["mariana"] };

function slots(items: VisitItem[], days: Map<string, ProfessionalDay | null>): VisitSlot[] {
  return computeVisitSlots({ dateKey: DAY, tz: TZ, now: NOW, items, days, slotIntervalMinutes: 15, minAdvanceMinutes: 60 });
}
const at = (list: VisitSlot[], hhmm: string) => list.find((s) => minutesToHHMM(s.minutes) === hhmm);

/** Invariantes que valem para QUALQUER regra de sequenciamento. */
function assertWellFormed(slot: VisitSlot, items: VisitItem[], days: Map<string, ProfessionalDay | null>) {
  assert.equal(slot.placements.length, items.length, "todo item recebe um horário");
  for (const item of items) {
    const p = slot.placements.find((x) => x.key === item.key);
    assert.ok(p, `item ${item.key} alocado`);
    assert.ok(item.candidates.includes(p.professionalId), `${item.key} com profissional habilitado`);
    assert.equal(p.end - p.start, item.durationMinutes, `${item.key} com a duração certa`);
    assert.ok(p.start >= slot.minutes, `${item.key} não começa antes da visita`);
    assert.ok(isRangeFree(days.get(p.professionalId)!, { start: p.start, end: p.end }), `${item.key} em horário livre de ${p.professionalId}`);
  }
  // Um mesmo profissional nunca faz dois itens da visita ao mesmo tempo.
  const byPro = new Map<string, { start: number; end: number }[]>();
  for (const p of slot.placements) byPro.set(p.professionalId, [...(byPro.get(p.professionalId) ?? []), p]);
  for (const [pid, ranges] of byPro) {
    for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++) {
      assert.ok(ranges[i].end <= ranges[j].start || ranges[j].end <= ranges[i].start, `${pid} não se sobrepõe a si mesma`);
    }
  }
}

describe("computeVisitSlots", () => {
  it("visita com um só item equivale ao horário simples", () => {
    const days = new Map([["ana", day()]]);
    const list = slots([CORTE], days);
    assert.equal(minutesToHHMM(list[0].minutes), "09:00");
    assert.equal(minutesToHHMM(list.at(-1)!.minutes), "17:15"); // 45 min cabem até 18:00
    for (const s of list) assertWellFormed(s, [CORTE], days);
  });

  it("Corte + Escova + Manicure: toda alocação é válida e a visita termina quando o último item termina", () => {
    const days = new Map([["ana", day([range(H(10), H(11))])], ["mariana", day()]]);
    const items = [CORTE, ESCOVA, MANICURE];
    const list = slots(items, days);
    assert.ok(list.length > 0, "há pelo menos um horário");
    for (const s of list) {
      assertWellFormed(s, items, days);
      const end = Math.max(...s.placements.map((p) => p.end));
      assert.equal(s.endsAt.getTime(), zonedDateTimeToUtc(DAY, end, TZ).getTime());
    }
  });

  it("não oferece início em que a sequência da Ana bate no agendamento das 10h", () => {
    const days = new Map([["ana", day([range(H(10), H(11))])], ["mariana", day()]]);
    const list = slots([CORTE, ESCOVA], days);
    // Corte 09:30–10:15 já invade as 10h; Escova depois do Corte das 09:00 (09:45–10:25) também.
    assert.ok(!at(list, "09:30"));
    assert.ok(!at(list, "09:00"));
    assert.ok(at(list, "11:00"));
  });

  it("'qualquer profissional': escolhe quem está livre entre os habilitados", () => {
    const days = new Map([["ana", day([range(H(9), H(12))])], ["carlos", day()]]);
    const corteQualquer: VisitItem = { key: "corte", durationMinutes: 45, candidates: ["ana", "carlos"] };
    const s = at(slots([corteQualquer], days), "09:00");
    assert.ok(s, "09:00 disponível via Carlos");
    assert.equal(s.placements[0].professionalId, "carlos");
  });

  it("dia fechado para um profissional obrigatório → sem horários", () => {
    const days = new Map<string, ProfessionalDay | null>([["ana", day()], ["mariana", null]]);
    assert.deepEqual(slots([CORTE, MANICURE], days), []);
  });

  it("respeita a antecedência mínima no início da visita", () => {
    const days = new Map([["ana", day()]]);
    const now = zonedDateTimeToUtc(DAY, H(9, 30), TZ);
    const list = computeVisitSlots({ dateKey: DAY, tz: TZ, now, items: [CORTE], days, slotIntervalMinutes: 15, minAdvanceMinutes: 60 });
    assert.equal(minutesToHHMM(list[0].minutes), "10:30");
  });
});

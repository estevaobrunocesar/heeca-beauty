import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProfessionalDay, buildRoomDay, contextFromDays, placeAddedItems,
  type ExistingItem, type ProfessionalDay, type RoomDay, type VisitItem,
} from "../src/lib/scheduling/availability";
import { zonedDateTimeToUtc } from "../src/lib/dates";

const TZ = "America/Sao_Paulo";
const DAY = "2026-09-21";
const NOW = zonedDateTimeToUtc("2026-09-20", 12 * 60, TZ);
const H = (h: number, m = 0) => h * 60 + m;
const range = (a: number, b: number) => ({ startsAt: zonedDateTimeToUtc(DAY, a, TZ), endsAt: zonedDateTimeToUtc(DAY, b, TZ) });

/** Dia 09:00–18:00 com buffer de 10 min entre atendimentos DE OUTRAS clientes. */
function day(appointments: { startsAt: Date; endsAt: Date }[] = []): ProfessionalDay {
  const d = buildProfessionalDay({
    dateKey: DAY, tz: TZ, now: NOW, rule: { startMinutes: H(9), endMinutes: H(18), breakStartMinutes: null, breakEndMinutes: null },
    exception: null, blocks: [], appointments, bufferMinutes: 10, maxAdvanceDays: 60, maxConcurrent: 1,
  });
  assert.ok(d);
  return d;
}
const NAIL: VisitItem = { key: "nail", durationMinutes: 60, candidates: ["mariana"] };
const cabelo = (extra: Partial<ExistingItem> = {}): ExistingItem => ({ professionalId: "ana", roomId: null, start: H(10), end: H(11), bufferBeforeMinutes: 0, bufferAfterMinutes: 0, resources: [], ...extra });

// O contexto vem SEM a própria visita (como no reagendamento): Ana está livre na agenda; o cabelo entra por `existing`.
describe("acrescentar serviço a uma visita já marcada (placeAddedItems)", () => {
  const ctxBase = (extraAppts: Record<string, { startsAt: Date; endsAt: Date }[]> = {}) =>
    contextFromDays({ days: new Map([["ana", day(extraAppts.ana)], ["mariana", day(extraAppts.mariana)]]) });

  it("cliente do cabelo (Ana 10h–11h) faz a unha ao mesmo tempo com a Mariana, a partir de 10:30", () => {
    const p = placeAddedItems({ startMinutes: H(10, 30), items: [NAIL], existing: [cabelo()], ctx: ctxBase(), parallel: false })!;
    assert.deepEqual(p.map((x) => [x.professionalId, x.start, x.end]), [["mariana", H(10, 30), H(11, 30)]]);
  });

  it("a mesma profissional não faz dois serviços ao mesmo tempo: a Ana não pode fazer a unha durante o cabelo", () => {
    const ANA_UNHA: VisitItem = { key: "unha", durationMinutes: 45, candidates: ["ana"] };
    assert.equal(placeAddedItems({ startMinutes: H(10, 30), items: [ANA_UNHA], existing: [cabelo()], ctx: ctxBase(), parallel: false }), null);
  });

  it("depois do último serviço a mesma profissional pode seguir: sem o intervalo entre atendimentos dentro da própria visita", () => {
    const ANA_UNHA: VisitItem = { key: "unha", durationMinutes: 45, candidates: ["ana"] };
    const p = placeAddedItems({ startMinutes: H(11), items: [ANA_UNHA], existing: [cabelo()], ctx: ctxBase(), parallel: false })!;
    assert.deepEqual([p[0].start, p[0].end], [H(11), H(11, 45)], "começa no minuto em que o cabelo termina");
  });

  it("outra cliente da Mariana às 11h bloqueia o novo serviço que invadiria o horário dela (com o intervalo)", () => {
    const ctx = ctxBase({ mariana: [range(H(11), H(12))] });
    assert.equal(placeAddedItems({ startMinutes: H(10, 30), items: [NAIL], existing: [cabelo()], ctx, parallel: false }), null, "10:30–11:30 invade as 11h");
    assert.ok(placeAddedItems({ startMinutes: H(9, 30), items: [NAIL], existing: [cabelo()], ctx, parallel: false }), "9:30–10:30 termina 30 min antes");
  });

  it("fora do expediente do profissional não cabe", () => {
    assert.equal(placeAddedItems({ startMinutes: H(17, 30), items: [NAIL], existing: [cabelo()], ctx: ctxBase(), parallel: false }), null);
  });

  it("sala: o novo serviço não usa a sala que o cabelo já usa no mesmo intervalo, e vai para outra", () => {
    const sala = (): RoomDay => buildRoomDay({ dateKey: DAY, tz: TZ, blocks: [], items: [] });
    const ctx = contextFromDays({ days: new Map([["ana", day()], ["mariana", day()]]), rooms: new Map([["s1", sala()], ["s2", sala()]]) });
    const COM_SALA: VisitItem = { key: "nail", durationMinutes: 60, candidates: ["mariana"], roomCandidates: ["s1", "s2"] };
    const p = placeAddedItems({ startMinutes: H(10, 30), items: [COM_SALA], existing: [cabelo({ roomId: "s1" })], ctx, parallel: false })!;
    assert.equal(p[0].roomId, "s2");
    const SO_S1: VisitItem = { ...COM_SALA, roomCandidates: ["s1"] };
    assert.equal(placeAddedItems({ startMinutes: H(10, 30), items: [SO_S1], existing: [cabelo({ roomId: "s1" })], ctx, parallel: false }), null);
  });
});

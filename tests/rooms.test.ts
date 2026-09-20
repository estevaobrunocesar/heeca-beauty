import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildResourceDay, buildRoomDay, computeVisitSlots, contextFromDays, isRoomFree, occupiedRange, pickRoom, placeVisit, resourceUnitsFree,
  type PlacementContext, type ProfessionalDay, type ResourceDay, type RoomDay, type VisitItem,
} from "../src/lib/scheduling/availability";

const dia = (busy: [number, number][] = []): ProfessionalDay => ({ windows: [{ start: 9 * 60, end: 18 * 60 }], blocked: [], busy: busy.map(([s, e]) => ({ start: s, end: e })), maxConcurrent: 1 });
const sala = (busy: [number, number][] = [], blocked: [number, number][] = []): RoomDay => ({ busy: busy.map(([s, e]) => ({ start: s, end: e })), blocked: blocked.map(([s, e]) => ({ start: s, end: e })) });
const recurso = (quantity: number, reservas: [number, number, number][] = []): ResourceDay => ({ quantity, blocked: [], reservations: reservas.map(([s, e, q]) => ({ range: { start: s, end: e }, quantity: q })) });
const ctxDe = (days: Record<string, ProfessionalDay>, rooms: Record<string, RoomDay> = {}, resources: Record<string, ResourceDay> = {}): PlacementContext =>
  contextFromDays({ days: new Map(Object.entries(days)), rooms: new Map(Object.entries(rooms)), resources: new Map(Object.entries(resources)) });

describe("salas", () => {
  it("sala livre = sem bloqueio e sem item no intervalo; sala desconhecida nunca está livre", () => {
    const s = sala([[600, 660]], [[720, 780]]);
    assert.equal(isRoomFree(s, { start: 540, end: 600 }), true);
    assert.equal(isRoomFree(s, { start: 630, end: 700 }), false);
    assert.equal(isRoomFree(s, { start: 700, end: 730 }), false);
    assert.equal(isRoomFree(undefined, { start: 540, end: 600 }), false);
  });
  it("pickRoom devolve a primeira livre na ordem cadastrada", () => {
    const ctx = ctxDe({}, { s1: sala([[600, 660]]), s2: sala(), s3: sala() });
    assert.equal(pickRoom(["s1", "s2", "s3"], { start: 600, end: 660 }, ctx), "s2");
    assert.equal(pickRoom(["s1", "s2", "s3"], { start: 700, end: 760 }, ctx), "s1");
    assert.equal(pickRoom(["s1"], { start: 600, end: 660 }, ctx), null);
  });
  it("preparo/limpeza alargam o intervalo ocupado pela sala, não pelo profissional", () => {
    assert.deepEqual(occupiedRange({ start: 600, end: 660 }, { bufferBeforeMinutes: 10, bufferAfterMinutes: 15 }), { start: 590, end: 675 });
    const item: VisitItem = { key: "a", durationMinutes: 60, candidates: ["p1"], roomCandidates: ["s1"], bufferAfterMinutes: 15 };
    // profissional livre às 11:00, sala ocupada até 11:10 pela limpeza do item anterior (10:00–11:00 + 15 min)
    const ctx = ctxDe({ p1: dia() }, { s1: sala([[600, 675]]) });
    assert.equal(placeVisit(660, [item], ctx), null);
    assert.equal(placeVisit(675, [item], ctx)?.[0].roomId, "s1");
  });
  it("serviço sem sala (roomCandidates null) ignora salas; lista vazia nunca cabe", () => {
    const ctx = ctxDe({ p1: dia() });
    assert.equal(placeVisit(600, [{ key: "a", durationMinutes: 30, candidates: ["p1"] }], ctx)?.[0].roomId, null);
    assert.equal(placeVisit(600, [{ key: "a", durationMinutes: 30, candidates: ["p1"], roomCandidates: [] }], ctx), null);
  });
  it("itens da mesma visita em sequência podem usar a mesma sala", () => {
    const ctx = ctxDe({ p1: dia(), p2: dia() }, { s1: sala() });
    const itens: VisitItem[] = [
      { key: "a", durationMinutes: 30, candidates: ["p1"], roomCandidates: ["s1"] },
      { key: "b", durationMinutes: 60, candidates: ["p2"], roomCandidates: ["s1"] },
    ];
    const p = placeVisit(600, itens, ctx)!;
    assert.deepEqual(p.map((x) => [x.roomId, x.start, x.end]), [["s1", 600, 630], ["s1", 630, 690]]);
  });
});

describe("recursos", () => {
  it("unidades livres = quantidade menos o pico de reservas que tocam o intervalo", () => {
    const r = recurso(2, [[600, 660, 1], [630, 700, 1], [700, 760, 2]]);
    assert.equal(resourceUnitsFree(r, { start: 540, end: 600 }), 2);
    assert.equal(resourceUnitsFree(r, { start: 600, end: 630 }), 1);
    assert.equal(resourceUnitsFree(r, { start: 600, end: 700 }), 0); // pico às 630: 2 em uso
    assert.equal(resourceUnitsFree(r, { start: 700, end: 720 }), 0);
    assert.equal(resourceUnitsFree(undefined, { start: 600, end: 630 }), 0);
  });
  it("bloqueio do recurso zera as unidades", () => {
    const r: ResourceDay = { ...recurso(3), blocked: [{ start: 600, end: 660 }] };
    assert.equal(resourceUnitsFree(r, { start: 630, end: 700 }), 0);
    assert.equal(resourceUnitsFree(r, { start: 660, end: 700 }), 3);
  });
  it("visita só cabe quando cada recurso tem unidades suficientes no intervalo com preparo", () => {
    const item: VisitItem = { key: "a", durationMinutes: 60, candidates: ["p1"], resources: [{ resourceId: "banheira", quantity: 1 }], bufferBeforeMinutes: 10 };
    const ctx = ctxDe({ p1: dia() }, {}, { banheira: recurso(1, [[540, 600, 1]]) });
    assert.equal(placeVisit(600, [item], ctx), null); // preparo 590–600 colide com a reserva até 600
    assert.ok(placeVisit(610, [item], ctx));
  });
  it("buildRoomDay/buildResourceDay recortam ao dia no fuso", () => {
    const tz = "America/Sao_Paulo";
    const r = buildRoomDay({ dateKey: "2026-09-21", tz, blocks: [], items: [{ startsAt: new Date("2026-09-21T13:00:00Z"), endsAt: new Date("2026-09-21T14:00:00Z") }] });
    assert.deepEqual(r.busy, [{ start: 600, end: 660 }]);
    const d = buildResourceDay({ dateKey: "2026-09-21", tz, quantity: 2, blocks: [], reservations: [{ startsAt: new Date("2026-09-20T13:00:00Z"), endsAt: new Date("2026-09-20T14:00:00Z"), quantity: 1 }] });
    assert.deepEqual(d.reservations, []);
  });
});

describe("computeVisitSlots com salas", () => {
  it("lista só os inícios em que profissional E sala estão livres", () => {
    const tz = "America/Sao_Paulo";
    const slots = computeVisitSlots({
      dateKey: "2026-09-21", tz, now: new Date("2026-09-20T12:00:00Z"),
      items: [{ key: "a", durationMinutes: 60, candidates: ["p1"], roomCandidates: ["s1"] }],
      days: new Map([["p1", { windows: [{ start: 600, end: 780 }], blocked: [], busy: [], maxConcurrent: 1 }]]),
      rooms: new Map([["s1", sala([[660, 720]])]]),
      slotIntervalMinutes: 60, minAdvanceMinutes: 0,
    });
    assert.deepEqual(slots.map((s) => s.minutes), [600, 720]);
    assert.equal(slots[0].placements[0].roomId, "s1");
  });
});

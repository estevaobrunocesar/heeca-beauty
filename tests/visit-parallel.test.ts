import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProfessionalDay, buildRoomDay, computeVisitSlots, placeVisit, placeVisitParallel, visitIsParallel, contextFromDays,
  type ProfessionalDay, type RoomDay, type VisitItem, type VisitSlot,
} from "../src/lib/scheduling/availability";
import { zonedDateTimeToUtc, minutesToHHMM } from "../src/lib/dates";

const TZ = "America/Sao_Paulo";
const DAY = "2026-09-21";
const NOW = zonedDateTimeToUtc("2026-09-20", 12 * 60, TZ);
const H = (h: number, m = 0) => h * 60 + m;
const range = (start: number, end: number) => ({ startsAt: zonedDateTimeToUtc(DAY, start, TZ), endsAt: zonedDateTimeToUtc(DAY, end, TZ) });

function day(appointments: { startsAt: Date; endsAt: Date }[] = []): ProfessionalDay {
  const d = buildProfessionalDay({
    dateKey: DAY, tz: TZ, now: NOW,
    rule: { startMinutes: H(9), endMinutes: H(18), breakStartMinutes: null, breakEndMinutes: null },
    exception: null, blocks: [], appointments, bufferMinutes: 0, maxAdvanceDays: 60, maxConcurrent: 1,
  });
  assert.ok(d);
  return d;
}
const days = (m: Record<string, ProfessionalDay | null>) => new Map(Object.entries(m));
const slots = (items: VisitItem[], d: Map<string, ProfessionalDay | null>, extra: { rooms?: Map<string, RoomDay> } = {}): VisitSlot[] =>
  computeVisitSlots({ dateKey: DAY, tz: TZ, now: NOW, items, days: d, slotIntervalMinutes: 15, minAdvanceMinutes: 60, parallel: true, ...extra });
const at = (list: VisitSlot[], hhmm: string) => list.find((s) => minutesToHHMM(s.minutes) === hhmm);

// Cliente corta o cabelo, faz a mão e os cílios ao mesmo tempo, cada um com a sua profissional.
const CORTE: VisitItem = { key: "corte", durationMinutes: 60, candidates: ["ana"] };
const MAO: VisitItem = { key: "mao", durationMinutes: 60, candidates: ["mariana"] };
const CILIOS: VisitItem = { key: "cilios", durationMinutes: 90, candidates: ["carla"] };

describe("visita simultânea: todos os serviços começam juntos", () => {
  const todas = days({ ana: day(), mariana: day(), carla: day() });

  it("corte 1h + mão 1h + cílios 1h30 em profissionais diferentes = 1h30 no total (em sequência seriam 3h30)", () => {
    const s = at(slots([CORTE, MAO, CILIOS], todas), "10:00")!;
    assert.ok(s);
    for (const p of s.placements) assert.equal(p.start, H(10), `${p.key} começa junto`);
    assert.deepEqual(s.placements.map((p) => [p.key, p.professionalId, p.end]), [["corte", "ana", H(11)], ["mao", "mariana", H(11)], ["cilios", "carla", H(11, 30)]]);
    assert.equal(s.endsAt.getTime(), zonedDateTimeToUtc(DAY, H(11, 30), TZ).getTime());

    const emSequencia = computeVisitSlots({ dateKey: DAY, tz: TZ, now: NOW, items: [CORTE, MAO, CILIOS], days: todas, slotIntervalMinutes: 15, minAdvanceMinutes: 60 });
    assert.equal(at(emSequencia, "10:00")!.endsAt.getTime(), zonedDateTimeToUtc(DAY, H(13, 30), TZ).getTime(), "regra antiga continua em sequência");
  });

  it("o horário só existe se TODOS os profissionais estão livres ao mesmo tempo", () => {
    const comMarianaOcupada = days({ ana: day(), mariana: day([range(H(10), H(11))]), carla: day() });
    const lista = slots([CORTE, MAO, CILIOS], comMarianaOcupada);
    assert.equal(at(lista, "10:00"), undefined, "mariana ocupada às 10h");
    assert.equal(at(lista, "10:30"), undefined, "10:30 invade a reserva dela");
    assert.ok(at(lista, "11:00"), "11:00 todos livres");
    assert.ok(at(lista, "09:00"), "09:00 cabe: a mão termina às 10h, quando a reserva começa");
  });

  it("um profissional nunca faz dois serviços ao mesmo tempo: o segundo vem depois do primeiro", () => {
    const ESCOVA: VisitItem = { key: "escova", durationMinutes: 30, candidates: ["ana"] };
    const s = at(slots([CORTE, ESCOVA, MAO], days({ ana: day(), mariana: day() })), "10:00")!;
    const by = Object.fromEntries(s.placements.map((p) => [p.key, p]));
    assert.equal(by.corte.start, H(10));
    assert.equal(by.escova.start, H(11), "ana termina o corte e só então faz a escova");
    assert.equal(by.mao.start, H(10), "a mão acontece junto do corte");
    assert.equal(s.endsAt.getTime(), zonedDateTimeToUtc(DAY, H(11, 30), TZ).getTime());
  });

  it("serviço com vários candidatos prefere começar junto: usa quem está livre", () => {
    const FLEX: VisitItem = { key: "flex", durationMinutes: 60, candidates: ["ana", "mariana"] };
    const s = at(slots([CORTE, FLEX], days({ ana: day(), mariana: day() })), "10:00")!;
    const flex = s.placements.find((p) => p.key === "flex")!;
    assert.equal(flex.professionalId, "mariana", "ana já está no corte");
    assert.equal(flex.start, H(10));
  });

  it("início possível = qualquer janela de qualquer profissional da visita (não só a do primeiro item)", () => {
    // ana só trabalha à tarde; mariana de manhã até às 18h: a visita só cabe quando AS DUAS estão abertas
    const anaTarde = buildProfessionalDay({
      dateKey: DAY, tz: TZ, now: NOW, rule: { startMinutes: H(14), endMinutes: H(18), breakStartMinutes: null, breakEndMinutes: null },
      exception: null, blocks: [], appointments: [], bufferMinutes: 0, maxAdvanceDays: 60, maxConcurrent: 1,
    })!;
    const lista = slots([MAO, CORTE], days({ mariana: day(), ana: anaTarde }));
    assert.equal(minutesToHHMM(lista[0].minutes), "14:00");
  });
});

describe("visita simultânea: sala e recursos", () => {
  const sala = (id: string): [string, RoomDay] => [id, buildRoomDay({ dateKey: DAY, tz: TZ, blocks: [], items: [] })];
  const d = days({ ana: day(), mariana: day() });
  const ctx = (rooms: string[]) => contextFromDays({ days: d, rooms: new Map(rooms.map(sala)) });

  it("duas pessoas não usam a mesma sala ao mesmo tempo: a segunda vai para outra sala", () => {
    const A: VisitItem = { key: "a", durationMinutes: 60, candidates: ["ana"], roomCandidates: ["s1", "s2"] };
    const B: VisitItem = { key: "b", durationMinutes: 60, candidates: ["mariana"], roomCandidates: ["s1", "s2"] };
    const p = placeVisitParallel(H(10), [A, B], ctx(["s1", "s2"]))!;
    assert.deepEqual(p.map((x) => x.roomId), ["s1", "s2"]);
  });

  it("com uma única sala, a visita simultânea não cabe (em sequência caberia)", () => {
    const A: VisitItem = { key: "a", durationMinutes: 60, candidates: ["ana"], roomCandidates: ["s1"] };
    const B: VisitItem = { key: "b", durationMinutes: 60, candidates: ["mariana"], roomCandidates: ["s1"] };
    assert.equal(placeVisitParallel(H(10), [A, B], ctx(["s1"])), null);
    assert.ok(placeVisit(H(10), [A, B], ctx(["s1"])), "em sequência a mesma sala serve");
  });

  it("recurso com 1 unidade não é consumido por dois itens ao mesmo tempo", () => {
    const resources = new Map([["maca", { quantity: 1, blocked: [], reservations: [] }]]);
    const c = contextFromDays({ days: d, resources });
    const A: VisitItem = { key: "a", durationMinutes: 60, candidates: ["ana"], resources: [{ resourceId: "maca", quantity: 1 }] };
    const B: VisitItem = { key: "b", durationMinutes: 60, candidates: ["mariana"], resources: [{ resourceId: "maca", quantity: 1 }] };
    assert.equal(placeVisitParallel(H(10), [A, B], c), null);
  });
});

describe("visitIsParallel (reagendamento mantém o modo da visita)", () => {
  const r = (a: number, b: number) => range(a, b);
  it("itens sobrepostos = simultânea; itens em fila ou um só = em sequência", () => {
    assert.equal(visitIsParallel([r(H(10), H(11)), r(H(10), H(11, 30))]), true);
    assert.equal(visitIsParallel([r(H(10), H(11)), r(H(10, 30), H(11, 30))]), true);
    assert.equal(visitIsParallel([r(H(10), H(11)), r(H(11), H(12))]), false);
    assert.equal(visitIsParallel([r(H(10), H(11))]), false);
    assert.equal(visitIsParallel([]), false);
  });
});

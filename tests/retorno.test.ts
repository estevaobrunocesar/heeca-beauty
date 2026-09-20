import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { learnIntervalDays, predictReturn, returnMessage, RETURN_STAGE_ORDER } from "../src/lib/clients/insights";
import { MARCAS, fraseDeRetorno, segmentoPorSlug } from "../src/lib/marca";

const D = 86_400_000;
const now = new Date("2026-09-19T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * D);

describe("learnIntervalDays — mediana dos últimos 3 intervalos válidos", () => {
  it("ciclo regular de 21 dias", () => {
    assert.equal(learnIntervalDays([daysAgo(84), daysAgo(63), daysAgo(42), daysAgo(21), daysAgo(0)]), 21);
  });
  it("ignora um intervalo destoante no meio (mediana) e só olha os 3 últimos", () => {
    // intervalos: 60, 21, 35, 21 → últimos 3 válidos: 21, 35, 21 → mediana 21
    assert.equal(learnIntervalDays([daysAgo(137), daysAgo(77), daysAgo(56), daysAgo(21), daysAgo(0)]), 21);
  });
  it("pausa longa (férias, gravidez) e retoque no mesmo dia não ensinam o ciclo", () => {
    // 150 dias de pausa e 2 dias de retoque saem; sobra 21
    assert.equal(learnIntervalDays([daysAgo(173), daysAgo(23), daysAgo(21), daysAgo(0)]), 21);
  });
  it("um atendimento só, ou só intervalos inválidos: null", () => {
    assert.equal(learnIntervalDays([daysAgo(0)]), null);
    assert.equal(learnIntervalDays([daysAgo(3), daysAgo(0)]), null);
  });
  it("dois intervalos válidos: média dos dois", () => {
    assert.equal(learnIntervalDays([daysAgo(50), daysAgo(20), daysAgo(0)]), 25);
  });
});

describe("predictReturn — estágios", () => {
  const ciclo21 = [daysAgo(63 + 0), daysAgo(42 + 0), daysAgo(21 + 0)]; // último há 21 dias, ciclo aprendido 21 → vence hoje
  it("sem histórico: unknown", () => {
    assert.equal(predictReturn({ completedDates: [], declaredIntervalDays: null, hasUpcoming: false, now }).stage, "unknown");
  });
  it("com horário futuro marcado nunca cobra, mesmo vencida", () => {
    const p = predictReturn({ completedDates: ciclo21, declaredIntervalDays: null, hasUpcoming: true, now });
    assert.equal(p.stage, "unknown");
    assert.equal(p.source, "learned");
  });
  it("no ponto: venceu hoje (até 7 dias de carência)", () => {
    const p = predictReturn({ completedDates: ciclo21, declaredIntervalDays: null, hasUpcoming: false, now });
    assert.equal(p.stage, "due");
    assert.equal(p.daysUntilDue, 0);
    assert.equal(p.intervalDays, 21);
  });
  it("chegando a hora: faltam até 5 dias", () => {
    const p = predictReturn({ completedDates: [daysAgo(60), daysAgo(39), daysAgo(18)], declaredIntervalDays: null, hasUpcoming: false, now });
    assert.equal(p.stage, "approaching");
    assert.equal(p.daysUntilDue, 3);
  });
  it("longe da data: unknown, mas com previsão (dueAt) para a ficha", () => {
    const p = predictReturn({ completedDates: [daysAgo(45), daysAgo(24), daysAgo(3)], declaredIntervalDays: null, hasUpcoming: false, now });
    assert.equal(p.stage, "unknown");
    assert.equal(p.daysUntilDue, 18);
    assert.ok(p.dueAt);
  });
  it("atrasada: passou da carência", () => {
    const p = predictReturn({ completedDates: [daysAgo(72), daysAgo(51), daysAgo(30)], declaredIntervalDays: null, hasUpcoming: false, now });
    assert.equal(p.stage, "overdue");
    assert.equal(p.daysUntilDue, -9);
  });
  it("inativa: 90+ dias sem vir, mesmo sem ciclo conhecido", () => {
    const p = predictReturn({ completedDates: [daysAgo(95)], declaredIntervalDays: null, hasUpcoming: false, now });
    assert.equal(p.stage, "inactive");
    assert.equal(p.daysSinceLast, 95);
  });
  it("ciclo declarado na ficha tem prioridade sobre o aprendido", () => {
    const p = predictReturn({ completedDates: ciclo21, declaredIntervalDays: 30, hasUpcoming: false, now });
    assert.equal(p.source, "declared");
    assert.equal(p.intervalDays, 30);
    assert.equal(p.daysUntilDue, 9);
    assert.equal(p.stage, "unknown");
  });
  it("ordem do painel: due < overdue < approaching < inactive", () => {
    assert.ok(RETURN_STAGE_ORDER.due < RETURN_STAGE_ORDER.overdue && RETURN_STAGE_ORDER.overdue < RETURN_STAGE_ORDER.approaching && RETURN_STAGE_ORDER.approaching < RETURN_STAGE_ORDER.inactive);
  });
});

describe("returnMessage — vocabulário do segmento", () => {
  const seg = (slug: string) => segmentoPorSlug(MARCAS.beauty, slug)!;
  it("convite usa a frase do segmento; primeiro nome; sumiço tem texto próprio", () => {
    assert.match(returnMessage("Ana Paula Souza", "approaching", fraseDeRetorno([seg("sobrancelhas")])), /^Oi, Ana![^]*sobrancelhas/);
    assert.match(returnMessage("Ana", "due", fraseDeRetorno([seg("unhas")])), /unhas/);
    assert.match(returnMessage("Ana", "inactive", fraseDeRetorno([seg("unhas")])), /Sentimos sua falta/);
    assert.doesNotMatch(returnMessage("Ana", "overdue", fraseDeRetorno([seg("unhas")])), /unhas/);
  });
  it("vários segmentos: frase neutra, sem vocabulário de um só", () => {
    const frase = fraseDeRetorno([seg("unhas"), seg("cabelo")]);
    assert.doesNotMatch(frase, /unhas|corte/);
    assert.match(returnMessage("Ana", "due", frase), /próximo atendimento/);
  });
  it("todo segmento de toda marca declara a frase de retorno", () => {
    for (const m of Object.values(MARCAS)) for (const s of m.segmentos) assert.ok(s.retorno.length > 10, s.slug);
  });
});

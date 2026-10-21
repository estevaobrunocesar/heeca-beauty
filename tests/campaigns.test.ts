import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aniversarioNoAno, estaInativa, montarMensagem, periodoDaCampanha, proximoAniversario, validarDiasReativacao } from "../src/lib/campaigns/rules";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("aniversário", () => {
  it("hoje conta como 0 dia", () => assert.deepEqual(proximoAniversario(d("1990-10-21"), "2026-10-21", 7), { dia: "2026-10-21", emDias: 0 }));
  it("dentro da janela devolve quantos dias faltam; fora da janela é null", () => {
    assert.deepEqual(proximoAniversario(d("1990-10-25"), "2026-10-21", 7), { dia: "2026-10-25", emDias: 4 });
    assert.equal(proximoAniversario(d("1990-11-30"), "2026-10-21", 7), null);
  });
  it("aniversário que já passou neste ano só volta no próximo (não entra na janela)", () => assert.equal(proximoAniversario(d("1990-10-20"), "2026-10-21", 7), null));
  it("vira o ano: 02/01 aparece em 28/12", () => assert.deepEqual(proximoAniversario(d("1990-01-02"), "2026-12-28", 7), { dia: "2027-01-02", emDias: 5 }));
  it("29/02 comemora em 28/02 nos anos não bissextos e em 29/02 nos bissextos", () => {
    assert.equal(aniversarioNoAno(d("1992-02-29"), 2027), "2027-02-28");
    assert.equal(aniversarioNoAno(d("1992-02-29"), 2028), "2028-02-29");
  });
});

describe("inativas", () => {
  const agora = new Date("2026-10-21T12:00:00Z");
  it("vira inativa ao completar os dias sem vir", () => {
    assert.equal(estaInativa({ ultimaVisita: new Date("2026-08-22T12:00:00Z"), temAgendamentoFuturo: false, agora, dias: 60 }).inativa, true);
    assert.equal(estaInativa({ ultimaVisita: new Date("2026-08-23T12:00:00Z"), temAgendamentoFuturo: false, agora, dias: 60 }).inativa, false);
  });
  it("com agendamento futuro não entra", () => assert.equal(estaInativa({ ultimaVisita: new Date("2026-01-01T12:00:00Z"), temAgendamentoFuturo: true, agora, dias: 60 }).inativa, false));
  it("quem nunca foi atendida não entra", () => assert.deepEqual(estaInativa({ ultimaVisita: null, temAgendamentoFuturo: false, agora, dias: 60 }), { inativa: false, diasSemVir: null }));
});

describe("mensagem e período", () => {
  it("troca {nome} pelo primeiro nome e {estabelecimento}", () =>
    assert.equal(montarMensagem("Oi, {nome}! Aqui é {estabelecimento}.", { nome: "Maria Oliveira", estabelecimento: "Studio 21" }), "Oi, Maria! Aqui é Studio 21."));
  it("marcador desconhecido permanece", () => assert.equal(montarMensagem("Oi {apelido}", { nome: "Ana", estabelecimento: "X" }), "Oi {apelido}"));
  it("período: aniversário por ano, reativação por mês", () => {
    assert.equal(periodoDaCampanha("BIRTHDAY", "2026-10-21"), "2026");
    assert.equal(periodoDaCampanha("REACTIVATION", "2026-10-21"), "2026-10");
  });
  it("dias de reativação entre 15 e 365", () => {
    assert.equal(validarDiasReativacao(14), false);
    assert.equal(validarDiasReativacao(60), true);
    assert.equal(validarDiasReativacao(366), false);
    assert.equal(validarDiasReativacao(60.5), false);
  });
});

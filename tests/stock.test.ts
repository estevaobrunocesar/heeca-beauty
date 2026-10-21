import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  baixaPendente, estornoPendente, movimentoManual, parseQuantidade, saldoDe, situacaoDe, usoDoAtendimento, valorEmEstoqueCents,
} from "../src/lib/stock/rules";

describe("saldo e situação", () => {
  it("saldo é a soma das movimentações com sinal", () => assert.equal(saldoDe([{ quantity: 10 }, { quantity: -3 }, { quantity: 2 }]), 9));
  it("zerado, negativo, baixo (igual ao mínimo já é baixo) e ok", () => {
    assert.equal(situacaoDe(0, 5), "zerado");
    assert.equal(situacaoDe(-2, 5), "negativo");
    assert.equal(situacaoDe(5, 5), "baixo");
    assert.equal(situacaoDe(6, 5), "ok");
  });
  it("mínimo 0 = sem alerta de mínimo", () => {
    assert.equal(situacaoDe(1, 0), "ok");
    assert.equal(situacaoDe(0, 0), "zerado");
  });
});

describe("quantidade digitada", () => {
  it("aceita inteiro, milhar com ponto e rejeita decimal, negativo e lixo", () => {
    assert.equal(parseQuantidade("12"), 12);
    assert.equal(parseQuantidade("1.500"), 1500);
    assert.equal(parseQuantidade("1,5"), null);
    assert.equal(parseQuantidade("-3"), null);
    assert.equal(parseQuantidade("abc"), null);
    assert.equal(parseQuantidade("99999999"), null);
  });
});

describe("movimento manual", () => {
  it("entrada soma; saída subtrai", () => {
    assert.deepEqual(movimentoManual({ kind: "PURCHASE", quantity: 10, saldoAtual: 5 }), { ok: true, delta: 10 });
    assert.deepEqual(movimentoManual({ kind: "LOSS", quantity: 2, saldoAtual: 5 }), { ok: true, delta: -2 });
  });
  it("saída maior que o saldo é recusada (o saldo não fica negativo à mão)", () => {
    const r = movimentoManual({ kind: "LOSS", quantity: 6, saldoAtual: 5 });
    assert.equal(r.ok, false);
  });
  it("quantidade zero é recusada em entrada e saída", () => {
    assert.equal(movimentoManual({ kind: "PURCHASE", quantity: 0, saldoAtual: 5 }).ok, false);
    assert.equal(movimentoManual({ kind: "LOSS", quantity: 0, saldoAtual: 5 }).ok, false);
  });
  it("acerto grava a diferença até a contagem (para cima, para baixo e até zero)", () => {
    assert.deepEqual(movimentoManual({ kind: "ADJUSTMENT", quantity: 8, saldoAtual: 5 }), { ok: true, delta: 3 });
    assert.deepEqual(movimentoManual({ kind: "ADJUSTMENT", quantity: 2, saldoAtual: 5 }), { ok: true, delta: -3 });
    assert.deepEqual(movimentoManual({ kind: "ADJUSTMENT", quantity: 0, saldoAtual: 5 }), { ok: true, delta: -5 });
    assert.deepEqual(movimentoManual({ kind: "ADJUSTMENT", quantity: 3, saldoAtual: -2 }), { ok: true, delta: 5 }, "corrige saldo negativo");
    assert.equal(movimentoManual({ kind: "ADJUSTMENT", quantity: 5, saldoAtual: 5 }).ok, false);
  });
});

describe("baixa automática do atendimento", () => {
  const receitas = [
    { serviceId: "coloracao", productId: "tinta", quantity: 60 },
    { serviceId: "coloracao", productId: "oxidante", quantity: 90 },
    { serviceId: "corte", productId: "luva", quantity: 2 },
    { serviceId: "coloracao", productId: "luva", quantity: 2 },
  ];
  it("soma a receita de cada serviço feito, por produto", () => {
    const uso = usoDoAtendimento([{ serviceId: "coloracao" }, { serviceId: "corte" }], receitas);
    assert.deepEqual([...uso], [["tinta", 60], ["oxidante", 90], ["luva", 4]]);
  });
  it("o mesmo serviço duas vezes na visita consome duas vezes", () => {
    assert.equal(usoDoAtendimento([{ serviceId: "corte" }, { serviceId: "corte" }], receitas).get("luva"), 4);
  });
  it("serviço sem receita não consome nada", () => assert.equal(usoDoAtendimento([{ serviceId: "unha" }], receitas).size, 0));

  it("é idempotente: concluir de novo não baixa de novo", () => {
    const esperado = new Map([["tinta", 60]]);
    assert.deepEqual([...baixaPendente(esperado, new Map())], [["tinta", 60]]);
    assert.equal(baixaPendente(esperado, new Map([["tinta", 60]])).size, 0);
  });
  it("completa só a diferença quando a visita ganhou um serviço depois", () => {
    const falta = baixaPendente(new Map([["tinta", 60], ["luva", 4]]), new Map([["tinta", 60], ["luva", 2]]));
    assert.deepEqual([...falta], [["luva", 2]]);
  });
  it("estorno devolve só o que realmente saiu", () => {
    assert.deepEqual([...estornoPendente(new Map([["tinta", 60], ["luva", 0], ["x", -1]]))], [["tinta", 60]]);
  });
});

describe("valor em estoque", () => {
  it("soma saldo × custo, ignorando sem custo e saldo negativo", () => {
    assert.equal(valorEmEstoqueCents([{ saldo: 3, costCents: 1000 }, { saldo: 5, costCents: null }, { saldo: -2, costCents: 500 }]), 3000);
  });
});

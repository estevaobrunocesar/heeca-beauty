import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { caixaEsperado, chaveDaDespesa, diaDaDespesa, diferencaDoCaixa, isMethod, resumoFinanceiro, rotuloDoCaixa } from "../src/lib/finance/rules";

describe("resumo financeiro", () => {
  const r = resumoFinanceiro(
    [{ cents: 10000, method: "PIX" }, { cents: 5000, method: "CASH" }, { cents: 2000, method: "PIX" }, { cents: 3000, method: null }],
    [{ cents: 4000, category: "Aluguel e contas", method: "PIX" }, { cents: 1000, category: "Outros", method: "CASH" }],
  );
  it("receita, despesa e resultado", () => {
    assert.equal(r.receitaCents, 20000);
    assert.equal(r.despesaCents, 5000);
    assert.equal(r.resultadoCents, 15000);
    assert.equal(r.margem, 0.75);
  });
  it("agrupa por forma de pagamento (maior primeiro) e separa o não informado", () => {
    assert.deepEqual(r.porForma, [{ nome: "Pix", cents: 12000 }, { nome: "Dinheiro", cents: 5000 }, { nome: "Não informado", cents: 3000 }]);
  });
  it("agrupa despesas por categoria", () => assert.deepEqual(r.porCategoria.map((c) => c.nome), ["Aluguel e contas", "Outros"]));
  it("sem receita não há margem; resultado pode ser negativo", () => {
    const v = resumoFinanceiro([], [{ cents: 100, category: "Outros", method: "CASH" }]);
    assert.equal(v.margem, null);
    assert.equal(v.resultadoCents, -100);
  });
});

describe("caixa", () => {
  const base = { openingCents: 10000, recebidoDinheiroCents: 25000, despesasDinheiroCents: 3000, suprimentoCents: 5000, sangriaCents: 20000 };
  it("esperado = troco + recebido + suprimento − despesas em dinheiro − sangria", () => assert.equal(caixaEsperado(base), 17000));
  it("caixa recém-aberto vale o troco inicial", () =>
    assert.equal(caixaEsperado({ openingCents: 8000, recebidoDinheiroCents: 0, despesasDinheiroCents: 0, suprimentoCents: 0, sangriaCents: 0 }), 8000));
  it("diferença: sobra, falta ou confere", () => {
    assert.equal(diferencaDoCaixa(17500, 17000), 500);
    assert.equal(rotuloDoCaixa(500), "sobra");
    assert.equal(rotuloDoCaixa(-200), "falta");
    assert.equal(rotuloDoCaixa(diferencaDoCaixa(17000, 17000)), "confere");
  });
});

describe("utilitários", () => {
  it("forma de pagamento válida", () => {
    assert.equal(isMethod("PIX"), true);
    assert.equal(isMethod("BOLETO"), false);
    assert.equal(isMethod(undefined), false);
  });
  it("despesa grava o dia ao meio-dia UTC e devolve o mesmo dia", () => {
    assert.equal(chaveDaDespesa(diaDaDespesa("2026-10-21")), "2026-10-21");
    assert.equal(diaDaDespesa("2026-10-21").toISOString(), "2026-10-21T12:00:00.000Z");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { commissionCentsFor, describeCommission, parseCommissionField, summarizeCommissions } from "../src/lib/commissions";

describe("commissionCentsFor", () => {
  it("sem acordo, vale a tabela padrão do serviço, sobre o preço do item (com adicionais)", () => {
    assert.equal(commissionCentsFor(8000, { standard: { percent: 40 } }), 3200); // SPEC §17: Corte R$ 80 · 40% = R$ 32
    assert.equal(commissionCentsFor(10500, { standard: { percent: 40 } }), 4200); // Corte + adicional
  });
  it("o acordo do profissional neste serviço tem precedência sobre a tabela padrão", () => {
    assert.equal(commissionCentsFor(8000, { agreement: { percent: 50 }, standard: { percent: 40 } }), 4000);
    assert.equal(commissionCentsFor(8000, { agreement: { percent: 30 } }), 2400);
  });
  it("cada profissional pode ter um acordo diferente no mesmo serviço", () => {
    const standard = { percent: 40 };
    assert.equal(commissionCentsFor(8000, { agreement: { percent: 50 }, standard }), 4000);
    assert.equal(commissionCentsFor(8000, { agreement: { percent: 35 }, standard }), 2800);
    assert.equal(commissionCentsFor(8000, { agreement: {}, standard }), 3200); // sem acordo: tabela
  });
  it("valor fixo vale mais que percentual dentro do mesmo nível", () => {
    assert.equal(commissionCentsFor(8000, { agreement: { percent: 50, fixedCents: 1500 } }), 1500);
    assert.equal(commissionCentsFor(8000, { standard: { percent: 40, fixedCents: 2000 } }), 2000);
  });
  it("o acordo em percentual vence a tabela mesmo que a tabela seja em valor fixo", () => {
    assert.equal(commissionCentsFor(8000, { agreement: { percent: 10 }, standard: { fixedCents: 2000 } }), 800);
  });
  it("acordo de 0% é um acordo (comissão zero), não 'sem regra'", () => {
    assert.equal(commissionCentsFor(8000, { agreement: { percent: 0 }, standard: { percent: 40 } }), 0);
  });
  it("sem regra → null (não comissionado), e não zero", () => {
    assert.equal(commissionCentsFor(8000, {}), null);
    assert.equal(commissionCentsFor(8000, { agreement: { percent: null, fixedCents: null }, standard: { percent: null, fixedCents: null } }), null);
  });
  it("arredonda para o centavo mais próximo e limita o percentual a 0..100", () => {
    assert.equal(commissionCentsFor(3333, { standard: { percent: 33 } }), 1100); // 1099,89 → 1100
    assert.equal(commissionCentsFor(3333, { standard: { percent: 150 } }), 3333);
    assert.equal(commissionCentsFor(3333, { standard: { percent: -5 } }), 0);
  });
});

describe("parseCommissionField", () => {
  it("vazio herda: não há comissão própria", () => {
    assert.deepEqual(parseCommissionField("pct", ""), {});
    assert.deepEqual(parseCommissionField("brl", "  "), {});
  });
  it("percentual inteiro entre 0 e 100", () => {
    assert.deepEqual(parseCommissionField("pct", "40"), { percent: 40 });
    assert.deepEqual(parseCommissionField("pct", "0"), { percent: 0 });
    assert.equal(parseCommissionField("pct", "101"), null);
    assert.equal(parseCommissionField("pct", "12,5"), null);
    assert.equal(parseCommissionField("pct", "abc"), null);
  });
  it("valor fixo em reais vira centavos", () => {
    assert.deepEqual(parseCommissionField("brl", "25"), { fixedCents: 2500 });
    assert.deepEqual(parseCommissionField("brl", "R$ 12,50"), { fixedCents: 1250 });
    assert.equal(parseCommissionField("brl", "-3"), null);
  });
});

describe("describeCommission", () => {
  const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
  it("mostra o valor fixo, o percentual ou um traço", () => {
    assert.equal(describeCommission({ fixedCents: 2500 }, brl), "R$ 25,00");
    assert.equal(describeCommission({ percent: 40 }, brl), "40%");
    assert.equal(describeCommission({ percent: 0 }, brl), "0%");
    assert.equal(describeCommission({}, brl), "—");
    assert.equal(describeCommission(null, brl), "—");
  });
});

describe("summarizeCommissions", () => {
  it("separa pago de pendente e ignora itens sem regra na comissão (mas conta no faturamento)", () => {
    const s = summarizeCommissions([
      { priceCents: 8000, commissionCents: 3200, commissionPaidAt: new Date() },
      { priceCents: 4500, commissionCents: 2250, commissionPaidAt: null },
      { priceCents: 6000, commissionCents: null, commissionPaidAt: null },
    ]);
    assert.deepEqual(s, { count: 3, revenueCents: 18500, commissionCents: 5450, paidCents: 3200, pendingCents: 2250 });
  });
});

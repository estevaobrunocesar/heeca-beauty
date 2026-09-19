import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { commissionCentsFor, summarizeCommissions } from "../src/lib/commissions";

describe("commissionCentsFor", () => {
  it("usa o percentual padrão do profissional sobre o preço do item (com adicionais)", () => {
    assert.equal(commissionCentsFor(8000, { professionalPercent: 40 }), 3200); // SPEC §17: Corte R$ 80 · 40% = R$ 32
    assert.equal(commissionCentsFor(10500, { professionalPercent: 40 }), 4200); // Corte + adicional
  });
  it("percentual por serviço tem precedência sobre o padrão", () => {
    assert.equal(commissionCentsFor(8000, { professionalPercent: 40, overridePercent: 50 }), 4000);
    assert.equal(commissionCentsFor(8000, { professionalPercent: null, overridePercent: 30 }), 2400);
  });
  it("valor fixo por execução tem precedência sobre qualquer percentual", () => {
    assert.equal(commissionCentsFor(8000, { professionalPercent: 40, overridePercent: 50, overrideFixedCents: 1500 }), 1500);
  });
  it("sem regra → null (não comissionado), e não zero", () => {
    assert.equal(commissionCentsFor(8000, { professionalPercent: null }), null);
    assert.equal(commissionCentsFor(8000, { professionalPercent: null, overridePercent: null, overrideFixedCents: null }), null);
  });
  it("arredonda para o centavo mais próximo e limita o percentual a 0..100", () => {
    assert.equal(commissionCentsFor(3333, { professionalPercent: 33 }), 1100); // 1099,89 → 1100
    assert.equal(commissionCentsFor(3333, { professionalPercent: 150 }), 3333);
    assert.equal(commissionCentsFor(3333, { professionalPercent: -5 }), 0);
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

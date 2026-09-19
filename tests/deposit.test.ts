import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDepositCents } from "../src/lib/payments/deposit";

describe("computeDepositCents", () => {
  it("NONE nunca cobra", () => {
    assert.equal(computeDepositCents({ depositMode: "NONE", depositValue: 50 }, 10000), 0);
  });
  it("PERCENT arredonda para o centavo", () => {
    assert.equal(computeDepositCents({ depositMode: "PERCENT", depositValue: 30 }, 4500), 1350);
    assert.equal(computeDepositCents({ depositMode: "PERCENT", depositValue: 33 }, 1001), 330);
  });
  it("PERCENT acima de 100 é limitado ao preço", () => {
    assert.equal(computeDepositCents({ depositMode: "PERCENT", depositValue: 150 }, 4500), 4500);
  });
  it("FIXED nunca ultrapassa o preço do serviço", () => {
    assert.equal(computeDepositCents({ depositMode: "FIXED", depositValue: 2000 }, 4500), 2000);
    assert.equal(computeDepositCents({ depositMode: "FIXED", depositValue: 2000 }, 1500), 1500);
  });
  it("valor irrisório (< R$ 1) ou serviço grátis não gera cobrança", () => {
    assert.equal(computeDepositCents({ depositMode: "PERCENT", depositValue: 5 }, 1500), 0); // R$ 0,75
    assert.equal(computeDepositCents({ depositMode: "FIXED", depositValue: 2000 }, 0), 0);
  });
});

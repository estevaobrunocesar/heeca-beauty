import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cashbackGanho, creditoPendente, saldoDoCashback, validarPercentual, validarUso } from "../src/lib/loyalty/rules";

describe("cashback", () => {
  it("ganha o percentual dos serviços, arredondado para baixo", () => {
    assert.equal(cashbackGanho(10000, 5), 500);
    assert.equal(cashbackGanho(3333, 5), 166);
  });
  it("sem percentual ou sem valor não ganha nada; percentual é limitado ao teto", () => {
    assert.equal(cashbackGanho(10000, 0), 0);
    assert.equal(cashbackGanho(0, 10), 0);
    assert.equal(cashbackGanho(10000, 90), 5000);
  });
  it("saldo é a soma com sinal", () => assert.equal(saldoDoCashback([{ amountCents: 500 }, { amountCents: -200 }, { amountCents: 100 }]), 400));
  it("crédito é idempotente e completa só a diferença", () => {
    assert.equal(creditoPendente(500, 0), 500);
    assert.equal(creditoPendente(500, 500), 0);
    assert.equal(creditoPendente(800, 500), 300);
    assert.equal(creditoPendente(300, 500), 0, "nunca debita sozinho");
  });
  it("uso: maior que zero e até o saldo", () => {
    assert.equal(validarUso(null, 1000).ok, false);
    assert.equal(validarUso(0, 1000).ok, false);
    assert.equal(validarUso(1001, 1000).ok, false);
    assert.deepEqual(validarUso(1000, 1000), { ok: true, valorCents: 1000 });
  });
  it("percentual configurável: inteiro de 0 a 50", () => {
    assert.equal(validarPercentual(0).ok, true);
    assert.equal(validarPercentual(50).ok, true);
    assert.equal(validarPercentual(51).ok, false);
    assert.equal(validarPercentual(2.5).ok, false);
    assert.equal(validarPercentual(-1).ok, false);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_CHARGES, parseExtras, totalExtras } from "../src/lib/appointments/charges";

describe("parseExtras (valores adicionais ao concluir)", () => {
  it("lê descrição e valor em reais, em vários formatos", () => {
    const r = parseExtras([{ description: " Tinta extra ", amount: "R$ 35,50" }, { description: "Ampola", amount: "12.9" }, { description: "Máscara", amount: "1.200,00" }]);
    assert.ok(r.ok);
    assert.deepEqual(r.extras, [{ description: "Tinta extra", amountCents: 3550 }, { description: "Ampola", amountCents: 1290 }, { description: "Máscara", amountCents: 120000 }]);
    assert.equal(totalExtras(r.extras), 3550 + 1290 + 120000);
  });

  it("linhas totalmente vazias são ignoradas; sem nenhuma linha preenchida não há adicional", () => {
    assert.deepEqual(parseExtras([{ description: "", amount: "" }, { description: "  ", amount: " " }]), { ok: true, extras: [] });
    assert.deepEqual(parseExtras([]), { ok: true, extras: [] });
  });

  it("valor sem descrição, descrição sem valor, zero e negativo são recusados com o motivo", () => {
    assert.match((parseExtras([{ description: "", amount: "10" }]) as { error: string }).error, /Descreva/);
    assert.match((parseExtras([{ description: "Tinta", amount: "" }]) as { error: string }).error, /valor maior que zero.*Tinta/);
    assert.match((parseExtras([{ description: "Tinta", amount: "0" }]) as { error: string }).error, /maior que zero/);
    assert.match((parseExtras([{ description: "Tinta", amount: "-5" }]) as { error: string }).error, /maior que zero/);
    assert.match((parseExtras([{ description: "Tinta", amount: "abc" }]) as { error: string }).error, /maior que zero/);
  });

  it("recusa descrição longa demais, valor absurdo e excesso de linhas", () => {
    assert.match((parseExtras([{ description: "x".repeat(121), amount: "10" }]) as { error: string }).error, /longa demais/);
    assert.match((parseExtras([{ description: "Tinta", amount: "999999" }]) as { error: string }).error, /alto demais/);
    const muitas = Array.from({ length: MAX_CHARGES + 1 }, (_, i) => ({ description: `item ${i}`, amount: "1" }));
    assert.match((parseExtras(muitas) as { error: string }).error, /No máximo/);
  });
});

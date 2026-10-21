import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exigeEscolhaDeUnidade, unidadeDaVisita, valeNaUnidade } from "../src/lib/units/rules";

describe("unidades", () => {
  it("sem unidade escolhida tudo vale", () => {
    assert.equal(valeNaUnidade("a", null), true);
    assert.equal(valeNaUnidade(null, undefined), true);
  });
  it("com unidade escolhida só vale a mesma, ou o que não tem unidade", () => {
    assert.equal(valeNaUnidade("a", "a"), true);
    assert.equal(valeNaUnidade("b", "a"), false);
    assert.equal(valeNaUnidade(null, "a"), true);
  });
  it("só exige escolher a unidade com 2 ou mais ativas", () => {
    assert.equal(exigeEscolhaDeUnidade(0), false);
    assert.equal(exigeEscolhaDeUnidade(1), false);
    assert.equal(exigeEscolhaDeUnidade(2), true);
  });
  it("unidade da visita: a escolhida; senão a do primeiro profissional que tem unidade", () => {
    assert.equal(unidadeDaVisita("x", ["y"]), "x");
    assert.equal(unidadeDaVisita(null, [null, "y", "z"]), "y");
    assert.equal(unidadeDaVisita(undefined, [null]), null);
    assert.equal(unidadeDaVisita(null, []), null);
  });
});

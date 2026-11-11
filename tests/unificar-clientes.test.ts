import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chaveDeNome, escolherPrincipal, gruposDuplicados, juntarFicha, juntarTexto } from "../src/lib/clients/unificar";

const c = (id: string, name: string, phone: string | null, atendimentos = 0, dia = 1) => ({ id, name, phone, atendimentos, createdAt: new Date(2026, 0, dia) });

describe("unificar clientes", () => {
  it("compara nomes sem acento, caixa e espaços", () => {
    assert.equal(chaveDeNome("  Adriana  Sá "), chaveDeNome("adriana sa"));
  });
  it("agrupa nomes iguais e fica com a que tem telefone", () => {
    const g = gruposDuplicados([c("a", "Adriana", null, 5), c("b", "adriana", "+5513999990000", 1), c("c", "Adriana", null, 0), c("d", "Bia", null)]);
    assert.equal(g.length, 1);
    assert.equal(g[0].principal.id, "b");
    assert.deepEqual(g[0].duplicadas.map((x) => x.id).sort(), ["a", "c"]);
  });
  it("sem telefone: fica a com mais atendimentos, depois a mais antiga", () => {
    assert.equal(escolherPrincipal([c("a", "X", null, 1, 3), c("b", "X", null, 4, 5)]).id, "b");
    assert.equal(escolherPrincipal([c("a", "X", null, 1, 3), c("b", "X", null, 1, 2)]).id, "b");
  });
  it("nunca junta duas com telefones diferentes", () => {
    assert.equal(gruposDuplicados([c("a", "Ana", "+5511900000001"), c("b", "Ana", "+5511900000002"), c("c", "Ana", null)]).length, 0);
  });
  it("junta observações sem repetir e a ficha da principal prevalece", () => {
    assert.equal(juntarTexto("alérgica", "alérgica"), "alérgica");
    assert.equal(juntarTexto(null, null), null);
    assert.deepEqual(juntarFicha({ "cabelo.tipo": "liso" }, { "cabelo.tipo": "crespo", "cabelo.cor": "loiro" }), { "cabelo.tipo": "liso", "cabelo.cor": "loiro" });
  });
});

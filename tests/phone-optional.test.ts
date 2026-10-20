import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseClientPhone, phoneLabel } from "../src/lib/phone";

describe("parseClientPhone (telefone obrigatório ou opcional por estabelecimento)", () => {
  it("obrigatório (padrão): vazio, espaços e null são recusados com o motivo", () => {
    for (const vazio of ["", "   ", null, undefined]) {
      assert.deepEqual(parseClientPhone(vazio, true), { ok: false, error: "Informe seu WhatsApp." });
    }
  });

  it("opcional: vazio vira null (cliente sem telefone)", () => {
    for (const vazio of ["", "   ", null, undefined]) assert.deepEqual(parseClientPhone(vazio, false), { ok: true, phone: null });
  });

  it("número válido é normalizado nos dois modos", () => {
    assert.deepEqual(parseClientPhone("(11) 99999-8888", true), { ok: true, phone: "+5511999998888" });
    assert.deepEqual(parseClientPhone("11999998888", false), { ok: true, phone: "+5511999998888" });
  });

  it("opcional não aceita lixo: se a pessoa digitou, tem que ser um número válido", () => {
    assert.deepEqual(parseClientPhone("abc", false), { ok: false, error: "Número de WhatsApp inválido." });
    assert.deepEqual(parseClientPhone("123", false), { ok: false, error: "Número de WhatsApp inválido." });
    assert.deepEqual(parseClientPhone("123", true), { ok: false, error: "Número de WhatsApp inválido." });
  });
});

describe("phoneLabel", () => {
  it("formata o telefone ou avisa que não há", () => {
    assert.equal(phoneLabel("+5511999998888"), "(11) 99999-8888");
    assert.equal(phoneLabel(null), "Sem telefone");
    assert.equal(phoneLabel(undefined), "Sem telefone");
  });
});

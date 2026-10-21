import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSION_KEYS, PERMISSIONS, ROLE_DEFAULTS, lerOverrides, normalizarMarcadas, overridesDoMarcado, permissoesEfetivas, podeFazer, resumoDeAcesso,
  type PermissionKey,
} from "../src/lib/permissions/rules";

describe("permissões por perfil", () => {
  it("toda permissão aparece na tela de acessos, uma vez só", () => {
    assert.deepEqual(PERMISSIONS.map((p) => p.key).sort(), [...PERMISSION_KEYS].sort());
  });
  it("dono tem tudo e nenhum ajuste tira algo dele", () => {
    const tudo = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false]));
    assert.equal(permissoesEfetivas("OWNER", tudo).size, PERMISSION_KEYS.length);
  });
  it("gerente mantém tudo o que tinha antes (compatibilidade)", () => assert.equal(permissoesEfetivas("MANAGER", {}).size, PERMISSION_KEYS.length));
  it("recepção: agenda da equipe, caixa e campanhas; sem financeiro nem comissões", () => {
    const r = permissoesEfetivas("RECEPTION", {});
    assert.equal(r.has("agenda_equipe") && r.has("caixa") && r.has("campanhas"), true);
    assert.equal(r.has("financeiro") || r.has("comissoes") || r.has("servicos"), false);
  });
  it("profissional: só a própria comissão", () => assert.deepEqual([...permissoesEfetivas("STAFF", {})], ["comissoes"]));
});

describe("ajustes por pessoa", () => {
  it("liberar um módulo a quem o perfil não tem", () => assert.equal(podeFazer("RECEPTION", { financeiro: true }, "financeiro"), true));
  it("tirar um módulo de quem o perfil tem", () => {
    assert.equal(podeFazer("MANAGER", { financeiro: false }, "financeiro"), false);
    assert.equal(podeFazer("MANAGER", { financeiro: false }, "relatorios"), true, "o resto continua");
  });
  it("sem ajuste vale o padrão do perfil", () => assert.equal(podeFazer("STAFF", {}, "comissoes"), true));
  it("lerOverrides ignora chaves desconhecidas, valores que não são booleanos e formatos errados", () => {
    assert.deepEqual(lerOverrides({ financeiro: true, hack: true, caixa: "sim", estoque: false }), { financeiro: true, estoque: false });
    assert.deepEqual(lerOverrides(null), {});
    assert.deepEqual(lerOverrides([1, 2]), {});
    assert.deepEqual(lerOverrides("x"), {});
  });
  it("guarda só o que difere do perfil", () => {
    const marcadas = new Set<PermissionKey>([...ROLE_DEFAULTS.RECEPTION, "financeiro"]);
    marcadas.delete("campanhas");
    assert.deepEqual(overridesDoMarcado("RECEPTION", marcadas), { financeiro: true, campanhas: false });
    assert.deepEqual(overridesDoMarcado("RECEPTION", new Set(ROLE_DEFAULTS.RECEPTION)), {});
  });
  it("trocar de perfil recalcula a partir do novo padrão", () => {
    const marcadas = new Set<PermissionKey>(["comissoes", "financeiro"]);
    assert.deepEqual(overridesDoMarcado("STAFF", marcadas), { financeiro: true });
  });
  it("acertar comissões puxa ver comissões", () => assert.equal(normalizarMarcadas(new Set<PermissionKey>(["comissoes_acertar"])).has("comissoes"), true));
  it("resumo conta extras e removidos", () => {
    assert.deepEqual(resumoDeAcesso("RECEPTION", { financeiro: true, campanhas: false }), { total: 3, extras: 1, removidos: 1 });
  });
});

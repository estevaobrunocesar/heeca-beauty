import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIAS_CONHECIDAS, HOSTS_LEGADOS, MARCAS, categoriasSugeridas, escolheuSegmentos, fichaDe, marcaDoHost, paleta, redirecionamentoDeHost, segmentosDe,
} from "../src/lib/marca";

describe("marcas e hosts", () => {
  it("resolve a marca pelo subdomínio; porta e caixa não importam", () => {
    assert.equal(marcaDoHost("beauty.heeca.com.br").slug, "beauty");
    assert.equal(marcaDoHost("WELLNESS.heeca.com.br:443").slug, "wellness");
  });
  it("host desconhecido cai em MARCA_DEFAULT ou beauty", () => {
    delete process.env.MARCA_DEFAULT;
    assert.equal(marcaDoHost("localhost:3000").slug, "beauty");
    process.env.MARCA_DEFAULT = "wellness";
    assert.equal(marcaDoHost("127.0.0.1").slug, "wellness");
    delete process.env.MARCA_DEFAULT;
  });
  it("hosts de produtos absorvidos apontam para a marca certa e pedem redirecionamento", () => {
    for (const [legado, alvo] of Object.entries(HOSTS_LEGADOS)) {
      assert.equal(marcaDoHost(`${legado}.heeca.com.br`).slug, alvo, legado);
      assert.equal(redirecionamentoDeHost(`${legado}.heeca.com.br`)?.slug, alvo, legado);
    }
    assert.equal(redirecionamentoDeHost("beauty.heeca.com.br"), null);
    assert.equal(redirecionamentoDeHost("localhost"), null);
  });
  it("toda marca tem cor válida, paleta completa e ao menos um segmento", () => {
    for (const m of Object.values(MARCAS)) {
      assert.match(m.cor, /^#[0-9a-f]{6}$/i, m.slug);
      const p = paleta(m);
      assert.equal(Object.keys(p).length, 11);
      assert.equal(p["--color-brand-600"], m.cor);
      assert.ok(m.segmentos.length > 0, m.slug);
    }
  });
});

describe("segmentos", () => {
  const beauty = MARCAS.beauty;
  it("slugs de segmento únicos por marca; slugs de categoria únicos entre todas as marcas", () => {
    for (const m of Object.values(MARCAS)) {
      const slugs = m.segmentos.map((s) => s.slug);
      assert.equal(new Set(slugs).size, slugs.length, m.slug);
    }
    const cats = Object.values(MARCAS).flatMap((m) => m.segmentos.flatMap((s) => s.categorias.map((c) => c.slug)));
    assert.equal(new Set(cats).size, cats.length, "categorias repetidas entre segmentos");
    assert.equal(Object.keys(CATEGORIAS_CONHECIDAS).length, cats.length);
  });
  it("sem escolha: todos os segmentos da marca valem e o painel sabe que falta escolher", () => {
    const t = { segmentos: [] as string[] };
    assert.equal(segmentosDe(beauty, t).length, beauty.segmentos.length);
    assert.equal(escolheuSegmentos(beauty, t), false);
  });
  it("com escolha: só os escolhidos, na ordem da marca; desconhecidos são ignorados", () => {
    const t = { segmentos: ["unhas", "cabelo", "inexistente"] };
    assert.deepEqual(segmentosDe(beauty, t).map((s) => s.slug), ["cabelo", "unhas"]);
    assert.equal(escolheuSegmentos(beauty, t), true);
    assert.equal(segmentosDe(beauty, { segmentos: ["inexistente"] }).length, beauty.segmentos.length);
  });
  it("ficha do estabelecimento é a união das fichas, com códigos prefixados pelo segmento", () => {
    const campos = fichaDe(segmentosDe(beauty, { segmentos: ["unhas", "sobrancelhas"] }));
    const codigos = campos.map((c) => c.codigo);
    assert.ok(codigos.includes("unhas.formato") && codigos.includes("sobrancelhas.formato"));
    assert.equal(new Set(codigos).size, codigos.length);
    assert.ok(campos.every((c) => c.segmento === "unhas" || c.segmento === "sobrancelhas"));
  });
  it("categorias sugeridas seguem a ordem dos segmentos ativos", () => {
    const cats = categoriasSugeridas(segmentosDe(beauty, { segmentos: ["estetica", "cabelo"] }));
    assert.deepEqual(cats.map((c) => c.slug), ["cabelo", "barba", "estetica-facial", "estetica-corporal"]);
  });
});

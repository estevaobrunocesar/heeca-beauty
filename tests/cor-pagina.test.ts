import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CONTRASTE_MINIMO, CORES_PRONTAS, ajustarCor, contraste, corDaPagina, normalizarHex, paletaDeCor } from "../src/lib/cor-pagina";
import { MARCAS, paleta } from "../src/lib/marca";

describe("normalizarHex", () => {
  it("aceita #rrggbb, rrggbb, #rgb e maiúsculas", () => {
    assert.equal(normalizarHex("#7A1F3D"), "#7a1f3d");
    assert.equal(normalizarHex("7a1f3d"), "#7a1f3d");
    assert.equal(normalizarHex(" #abc "), "#aabbcc");
  });
  it("recusa o que não é cor", () => {
    for (const ruim of ["", "#12", "#12345", "#1234567", "vermelho", "#gggggg", "rgb(1,2,3)"]) assert.equal(normalizarHex(ruim), null, ruim);
  });
});

describe("contraste e ajuste (texto branco sobre a cor da página)", () => {
  it("branco sobre preto é 21 e branco sobre branco é 1", () => {
    assert.equal(Math.round(contraste("#ffffff", "#000000")), 21);
    assert.equal(Math.round(contraste("#ffffff", "#ffffff")), 1);
  });

  it("cor escura não é ajustada", () => {
    assert.deepEqual(ajustarCor("#7a1f3d"), { cor: "#7a1f3d", ajustada: false });
  });

  it("cor clara é escurecida até o contraste mínimo, mantendo o matiz", () => {
    for (const clara of ["#ffd1dc", "#ffff00", "#f5f5f5", "#a0e0ff", "#ffffff"]) {
      const r = ajustarCor(clara);
      assert.equal(r.ajustada, true, clara);
      assert.ok(contraste(r.cor, "#ffffff") >= CONTRASTE_MINIMO, `${clara} → ${r.cor}`);
    }
    // matiz preservado: rosa claro continua rosado (vermelho > verde)
    const rosa = ajustarCor("#ffd1dc").cor;
    assert.ok(parseInt(rosa.slice(1, 3), 16) > parseInt(rosa.slice(3, 5), 16));
  });

  it("todas as cores prontas já passam sem ajuste", () => {
    for (const c of CORES_PRONTAS) assert.equal(ajustarCor(c.cor).ajustada, false, `${c.nome} ${c.cor} precisa de ajuste`);
  });
});

describe("paleta", () => {
  it("o tom 600 é a cor-base e os claros/escuros escalam em ordem", () => {
    const p = paletaDeCor("#7a1f3d");
    assert.equal(p["--color-brand-600"], "#7a1f3d");
    assert.equal(Object.keys(p).length, 11);
    const lum = (t: string) => contraste(p[`--color-brand-${t}`], "#000000");
    assert.ok(lum("50") > lum("300") && lum("300") > lum("600") && lum("600") > lum("900") && lum("900") > lum("950"));
  });

  it("paleta(marca) continua igual à paleta da cor da marca (regressão da refatoração)", () => {
    assert.deepEqual(paleta(MARCAS.beauty), paletaDeCor(MARCAS.beauty.cor));
    assert.equal(paleta(MARCAS.beauty)["--color-brand-600"], "#c8306f");
    assert.equal(paleta(MARCAS.beauty)["--color-brand-700"], "#a4275b"); // mesmo valor do default em globals.css
  });
});

describe("corDaPagina", () => {
  it("usa a cor do estabelecimento; vazio, nulo ou inválido cai na cor da marca", () => {
    assert.equal(corDaPagina("#7a1f3d", "#c8306f"), "#7a1f3d");
    assert.equal(corDaPagina(null, "#c8306f"), "#c8306f");
    assert.equal(corDaPagina("", "#c8306f"), "#c8306f");
    assert.equal(corDaPagina("lixo", "#c8306f"), "#c8306f");
  });
});

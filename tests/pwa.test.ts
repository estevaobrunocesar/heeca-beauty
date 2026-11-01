import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { convidarParaInstalar, ehIos, manifestoDaMarca } from "../src/lib/pwa";
import { MARCAS } from "../src/lib/marca";

describe("app instalável (PWA)", () => {
  it("manifesto sai da marca: nome, cor e ícones por slug, abrindo no painel", () => {
    for (const marca of Object.values(MARCAS)) {
      const m = manifestoDaMarca(marca);
      assert.equal(m.name, marca.nome);
      assert.equal(m.theme_color, marca.cor);
      assert.equal(m.start_url, "/app");
      assert.equal(m.display, "standalone");
      assert.deepEqual(m.icons.map((i) => i.src), [`/brand/${marca.slug}/icon-192.png`, `/brand/${marca.slug}/icon-512.png`]);
    }
  });

  it("convida só no navegador comum, e não de novo depois de dispensado", () => {
    assert.equal(convidarParaInstalar({ standalone: false, nativo: false, dispensado: false }), true);
    assert.equal(convidarParaInstalar({ standalone: true, nativo: false, dispensado: false }), false);
    assert.equal(convidarParaInstalar({ standalone: false, nativo: true, dispensado: false }), false);
    assert.equal(convidarParaInstalar({ standalone: false, nativo: false, dispensado: true }), false);
  });

  it("reconhece iPhone, iPad (que se apresenta como Mac) e não confunde Android nem Mac", () => {
    assert.equal(ehIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
    assert.equal(ehIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), true);
    assert.equal(ehIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), false);
    assert.equal(ehIos("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), false);
  });
});

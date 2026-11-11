import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CORES_ESCURAS, ESCALA_CAPA, PELE_ESCURA, temaDoTenant } from "../src/lib/temas";
import { contraste } from "../src/lib/cor-pagina";

const TONS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

describe("temas por estabelecimento", () => {
  it("só o Studio 21 tem tema; os demais seguem a paleta da marca", () => {
    assert.equal(temaDoTenant({ slug: "studio21" })?.logo, "/tenants/studio21/logo.png");
    assert.equal(temaDoTenant({ slug: "salao-bela-vista" }), null);
    assert.equal(temaDoTenant({ slug: "Studio21" }), null);
  });

  it("as duas escalas cobrem todos os tons brand-50…950", () => {
    for (const escala of [ESCALA_CAPA, PELE_ESCURA]) for (const t of TONS) assert.match(escala[`--color-brand-${t}`] ?? "", /^#[0-9a-f]{6}$/);
  });
});

describe("pele escura: contraste legível", () => {
  const branco = PELE_ESCURA["--color-white"];
  it("texto principal sobre o fundo e sobre cartões", () => {
    assert.ok(contraste(PELE_ESCURA["--color-ink"], branco) >= 12);
    assert.ok(contraste(PELE_ESCURA["--color-brand-950"], PELE_ESCURA["--color-brand-50"]) >= 10);
  });
  it("texto secundário (zinc-500 e mut) passa de 4.5", () => {
    assert.ok(contraste(PELE_ESCURA["--color-zinc-500"], branco) >= 4.5);
    assert.ok(contraste(PELE_ESCURA["--color-mut"], branco) >= 4.5);
  });
  it("botão de acento: texto `white` (escuro) sobre o acento claro, e o hover", () => {
    assert.ok(contraste(branco, PELE_ESCURA["--color-brand-600"]) >= 12);
    assert.ok(contraste(branco, PELE_ESCURA["--color-brand-700"]) >= 12);
  });
  it("a linha se distingue do fundo", () => {
    assert.ok(contraste(PELE_ESCURA["--color-line"], branco) >= 1.2);
  });
});

describe("capa escura", () => {
  it("texto claro sobre o fundo e eyebrow legível", () => {
    assert.ok(contraste(ESCALA_CAPA["--color-brand-50"], ESCALA_CAPA["--color-brand-950"]) >= 12);
    assert.ok(contraste(ESCALA_CAPA["--color-brand-200"], ESCALA_CAPA["--color-brand-950"]) >= 7);
    assert.equal(ESCALA_CAPA["--color-brand-950"], CORES_ESCURAS.fundo);
  });
});

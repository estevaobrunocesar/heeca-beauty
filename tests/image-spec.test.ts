import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACCEPTED_LABEL, ACCEPTED_TYPES, MAX_SIDE, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, SVG_REFUSED, checkImageFile, imageSpecText } from "../src/lib/image-spec";

describe("especificação de imagem (texto da tela = o que a rota aceita)", () => {
  it("o texto cita todos os formatos aceitos e nenhum a mais", () => {
    const nomes = ACCEPTED_LABEL.split(/,| ou /).map((x) => x.trim()).filter(Boolean);
    assert.deepEqual(nomes, ["JPG", "PNG", "WebP", "GIF", "HEIC", "AVIF"]);
    // cada nome do texto corresponde a um tipo realmente aceito (heif é o mesmo HEIC)
    const porNome: Record<string, string[]> = { JPG: ["image/jpeg"], PNG: ["image/png"], WebP: ["image/webp"], GIF: ["image/gif"], HEIC: ["image/heic", "image/heif"], AVIF: ["image/avif"] };
    assert.deepEqual(Object.values(porNome).flat().sort(), [...ACCEPTED_TYPES].sort());
  });

  it("o limite do texto é o limite da rota", () => {
    assert.equal(MAX_UPLOAD_BYTES, 8 * 1024 * 1024);
    assert.equal(MAX_UPLOAD_LABEL, "8 MB");
  });

  it("cada campo mostra o lado máximo do seu tipo e avisa que SVG não é aceito", () => {
    assert.match(imageSpecText("logo"), /512 px/);
    assert.match(imageSpecText("service"), /1200 px/);
    assert.match(imageSpecText("portfolio"), /1600 px/);
    for (const kind of Object.keys(MAX_SIDE) as (keyof typeof MAX_SIDE)[]) {
      const t = imageSpecText(kind);
      assert.match(t, /até 8 MB/);
      assert.match(t, /SVG não é aceito/);
      assert.match(t, /WebP/);
    }
  });
});

describe("checkImageFile (validação antes do envio)", () => {
  it("aceita os formatos da lista e tipo vazio (HEIC/AVIF sem tipo no navegador)", () => {
    for (const type of ACCEPTED_TYPES) assert.equal(checkImageFile({ size: 1000, type }), null);
    assert.equal(checkImageFile({ size: 1000, type: "" }), null);
  });

  it("recusa SVG com motivo próprio e outros formatos com a lista", () => {
    assert.equal(checkImageFile({ size: 1000, type: "image/svg+xml" }), SVG_REFUSED);
    assert.match(checkImageFile({ size: 1000, type: "application/pdf" }) ?? "", /Formato não suportado.*JPG, PNG, WebP, GIF, HEIC ou AVIF/);
  });

  it("recusa acima de 8 MB e aceita exatamente 8 MB", () => {
    assert.match(checkImageFile({ size: MAX_UPLOAD_BYTES + 1, type: "image/png" }) ?? "", /muito grande \(máximo 8 MB\)/);
    assert.equal(checkImageFile({ size: MAX_UPLOAD_BYTES, type: "image/png" }), null);
  });
});

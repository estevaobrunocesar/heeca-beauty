import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processImage, ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from "../src/lib/images";

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 50, b: 120 } } }).png().toBuffer();

describe("processImage", () => {
  it("converte para WebP e limita o lado maior ao do tipo (logo 512, portfólio 1600)", async () => {
    const logo = await processImage(await png(2000, 1000), "logo");
    assert.equal(logo.contentType, "image/webp");
    assert.equal(Math.max(logo.width, logo.height), 512);
    assert.equal((await sharp(logo.data).metadata()).format, "webp");

    const work = await processImage(await png(3000, 2000), "portfolio");
    assert.equal(Math.max(work.width, work.height), 1600);
  });

  it("não amplia imagem pequena", async () => {
    const out = await processImage(await png(200, 100), "portfolio");
    assert.deepEqual([out.width, out.height], [200, 100]);
  });

  it("mantém a proporção", async () => {
    const out = await processImage(await png(2000, 1000), "service");
    assert.deepEqual([out.width, out.height], [1200, 600]);
  });

  it("remove metadados EXIF (GPS de foto de celular)", async () => {
    const withExif = await sharp(await png(400, 400)).withExif({ IFD0: { Copyright: "x", Software: "camera" } }).jpeg().toBuffer();
    assert.ok((await sharp(withExif).metadata()).exif, "pré-condição: a entrada tem EXIF");
    const out = await processImage(withExif, "professional");
    assert.equal((await sharp(out.data).metadata()).exif, undefined);
  });

  it("recusa arquivo que não é imagem", async () => {
    await assert.rejects(() => processImage(Buffer.from("isto não é uma imagem"), "logo"));
  });
});

describe("limites", () => {
  it("aceita só formatos de imagem e tem teto de 8 MB", () => {
    assert.ok(ACCEPTED_TYPES.every((t) => t.startsWith("image/")));
    assert.ok(!ACCEPTED_TYPES.includes("image/svg+xml"), "SVG pode carregar script — não entra");
    assert.equal(MAX_UPLOAD_BYTES, 8 * 1024 * 1024);
  });
});

// Só a rota /api/uploads importa este módulo (sharp não vai para o navegador); sem `server-only`
// para o processamento poder ser testado com a lib real em tests/images.test.ts.
import sharp from "sharp";

import { MAX_SIDE, type ImageKind } from "./image-spec";

// A especificação (formatos, limite, lado maior) vive em image-spec.ts, que o navegador também importa.
export { ACCEPTED_TYPES, IMAGE_KINDS, MAX_UPLOAD_BYTES, type ImageKind } from "./image-spec";

/**
 * Valida e normaliza a imagem: corrige a orientação (EXIF), limita o lado maior e converte para
 * WebP. Remove os metadados — foto de celular carrega GPS, e a cliente do salão não precisa expor
 * onde o profissional mora.
 */
export async function processImage(input: Buffer, kind: ImageKind): Promise<{ data: Buffer; contentType: "image/webp"; width: number; height: number }> {
  const img = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error("Arquivo não é uma imagem válida.");
  const side = MAX_SIDE[kind];
  const out = await img
    .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data: out.data, contentType: "image/webp", width: out.info.width, height: out.info.height };
}

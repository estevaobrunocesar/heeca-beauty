// Especificação de imagem aceita pelo /api/uploads. Sem sharp nem server-only: vale no navegador
// (texto da tela, validação antes do envio) e na rota. A rota é quem decide; isto só descreve.
export type ImageKind = "logo" | "professional" | "service" | "portfolio" | "space";

export const IMAGE_KINDS: ImageKind[] = ["logo", "professional", "service", "portfolio", "space"];

/** Lado maior, em px, por tipo: avatar/logo pequenos; serviço médio; fotos de trabalho e do espaço maiores. */
export const MAX_SIDE: Record<ImageKind, number> = { logo: 512, professional: 512, service: 1200, portfolio: 1600, space: 1600 };

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif"];

/** Nomes que a pessoa reconhece, na mesma ordem de ACCEPTED_TYPES (heif entra como HEIC). */
export const ACCEPTED_LABEL = "JPG, PNG, WebP, GIF, HEIC ou AVIF";
export const MAX_UPLOAD_LABEL = "8 MB";

/** Texto fixo sob o botão de envio, igual em todos os campos de imagem. */
export function imageSpecText(kind: ImageKind): string {
  return `${ACCEPTED_LABEL}, até ${MAX_UPLOAD_LABEL}. SVG não é aceito. A imagem é convertida para WebP, reduzida para no máximo ${MAX_SIDE[kind]} px no lado maior e guardada sem dados de localização.`;
}

export const SVG_REFUSED = "SVG não é aceito. Use " + ACCEPTED_LABEL + ".";

/** Validação feita no navegador antes de enviar: devolve o motivo ou null. A rota repete tudo. */
export function checkImageFile(file: { size: number; type: string }): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return `Imagem muito grande (máximo ${MAX_UPLOAD_LABEL}).`;
  // Alguns navegadores não informam o tipo de HEIC/AVIF: sem tipo, quem decide é o servidor.
  if (file.type === "image/svg+xml") return SVG_REFUSED;
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) return `Formato não suportado. Use ${ACCEPTED_LABEL}.`;
  return null;
}

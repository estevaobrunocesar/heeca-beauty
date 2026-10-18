/**
 * Regra da plataforma (28/09): nenhum campo de imagem aceita URL colada — só upload para o bucket do
 * produto. Este é o guarda do SERVIDOR: mesmo que alguém forje o formulário, a action só grava uma
 * URL que (a) é do nosso storage e (b) está na pasta do próprio estabelecimento.
 *
 * Pura de propósito (sem server-only, sem storage real) para ser testada com um `keyFromUrl` falso.
 */
export type ImageCheck = { ok: true; url: string | null } | { ok: false };

export function checkImageUrl(
  tenantId: string,
  url: string | null | undefined,
  keyFromUrl: (url: string) => string | null,
  /** Valor já gravado. Dado legado (URL externa herdada do Nail/Skin) pode ser mantido até a pessoa trocar. */
  current?: string | null,
): ImageCheck {
  const value = (url ?? "").trim();
  if (!value) return { ok: true, url: null };
  if (current && value === current) return { ok: true, url: value };
  const key = keyFromUrl(value);
  if (key && key.startsWith(`${tenantId}/`)) return { ok: true, url: value };
  return { ok: false };
}

export const IMAGE_REJECTED = "Envie a imagem pelo botão de upload — não é possível usar um link.";

import "server-only";
import { getStorage } from "./index";
import { checkImageUrl, IMAGE_REJECTED, type ImageCheck } from "./ownership";

export { IMAGE_REJECTED };

/** Valida uma URL de imagem vinda de formulário contra o storage real do produto. */
export function guardImageUrl(tenantId: string, url: string | null | undefined, current?: string | null): ImageCheck {
  return checkImageUrl(tenantId, url, (u) => getStorage().keyFromUrl(u), current);
}

/**
 * Apaga do bucket o arquivo que deixou de ser usado (trocado ou removido). Chamar DEPOIS de gravar o
 * registro. Melhor esforço, e só mexe em arquivo do próprio estabelecimento: URL externa (dado
 * legado) ou de outro tenant é ignorada.
 */
export async function discardReplaced(tenantId: string, previous: string | null | undefined, next: string | null | undefined) {
  if (!previous || previous === next) return;
  const storage = getStorage();
  const key = storage.keyFromUrl(previous);
  if (key && key.startsWith(`${tenantId}/`)) await storage.remove(key);
}

/** Lista de imagens (uma por linha): todas precisam passar; as que já estavam gravadas (`current`) são mantidas. */
export function guardImageUrls(tenantId: string, urls: string[], current: string[] = []): { ok: true; urls: string[] } | { ok: false } {
  const out: string[] = [];
  for (const u of urls) {
    const r = guardImageUrl(tenantId, u, current.includes(u) ? u : null);
    if (!r.ok) return { ok: false };
    if (r.url) out.push(r.url);
  }
  return { ok: true, urls: out };
}

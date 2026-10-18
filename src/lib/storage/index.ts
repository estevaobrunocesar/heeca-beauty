import "server-only";
import type { StorageProvider } from "./provider";
import { LocalStorage } from "./providers/local";
import { S3Storage } from "./providers/s3";

let cached: StorageProvider | null = null;

/** STORAGE_PROVIDER=local (padrão em dev) | s3 (produção: bucket público do produto no R2). */
export function getStorage(): StorageProvider {
  if (cached) return cached;
  const name = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  // Container sem volume: um upload "local" some no próximo deploy. Falha cedo e claro, em vez de
  // aceitar a imagem hoje e quebrá-la amanhã.
  if (name === "local" && process.env.NODE_ENV === "production") {
    throw new Error("STORAGE_PROVIDER=local não persiste em produção. Configure s3 (S3_BUCKET, S3_PUBLIC_URL, S3_PREFIX…).");
  }
  cached = name === "s3" ? new S3Storage() : new LocalStorage();
  return cached;
}

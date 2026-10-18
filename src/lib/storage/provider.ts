/**
 * Armazenamento de imagens públicas (logo, fotos do salão, portfólio, profissionais, serviços).
 * Implementações: LocalStorage (disco, só dev) e S3Storage (R2/S3/MinIO — produção).
 *
 * Todas as chaves aqui são RELATIVAS ao produto: "<tenantId>/<tipo>/<id>.webp". O prefixo da marca
 * no bucket compartilhado (S3_PREFIX: "beauty/", "wellness/") é detalhe interno do S3Storage — entra
 * na chave do objeto e na URL, mas nunca aparece para quem chama.
 */
export interface StorageProvider {
  readonly name: string;
  /** Grava o arquivo e devolve a URL pública. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  /** Remove pela chave relativa. Nunca lança por arquivo inexistente. */
  remove(key: string): Promise<void>;
  /** URL pública nossa → chave relativa; null se a URL não for deste storage/produto. */
  keyFromUrl(url: string): string | null;
}

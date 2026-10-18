import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { StorageProvider } from "../provider";

/**
 * S3 e compatíveis (Cloudflare R2, MinIO, Backblaze B2).
 * O bucket precisa de leitura pública (domínio público em S3_PUBLIC_URL, ex.: cdn.heeca.com.br).
 * S3_PREFIX: pasta da marca dentro do bucket compartilhado ("beauty", "wellness"). Entra na chave
 * do objeto e na URL; as chaves que o resto do código enxerga são sempre relativas.
 */
export class S3Storage implements StorageProvider {
  readonly name = "s3";
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly prefix: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION ?? "auto";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!bucket || !accessKeyId || !secretAccessKey) throw new Error("S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY não configurados");
    this.bucket = bucket;
    this.client = new S3Client({
      region,
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
      credentials: { accessKeyId, secretAccessKey },
    });
    this.publicBase = (process.env.S3_PUBLIC_URL ?? (process.env.S3_ENDPOINT ? `${process.env.S3_ENDPOINT}/${bucket}` : `https://${bucket}.s3.${region}.amazonaws.com`)).replace(/\/$/, "");
    this.prefix = (process.env.S3_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
  }

  private objectKey(key: string) {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    const objectKey = this.objectKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
    return `${this.publicBase}/${objectKey}`;
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) })).catch(() => {});
  }

  keyFromUrl(url: string): string | null {
    const base = this.prefix ? `${this.publicBase}/${this.prefix}/` : `${this.publicBase}/`;
    if (!url.startsWith(base)) return null; // outro host, outro bucket ou outra marca no mesmo bucket
    const key = url.slice(base.length);
    return key && !key.includes("..") && !key.includes("?") ? key : null;
  }
}

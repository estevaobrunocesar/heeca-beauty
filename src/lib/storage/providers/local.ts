import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "../provider";

/**
 * Grava em public/uploads — servido pelo Next como arquivo estático.
 * SÓ para desenvolvimento: em produção o disco do container é efêmero (o index.ts recusa).
 */
export class LocalStorage implements StorageProvider {
  readonly name = "local";
  private readonly root = path.join(process.cwd(), "public", "uploads");
  private readonly base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  async put(key: string, body: Buffer): Promise<string> {
    const file = path.join(this.root, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return `${this.base}/uploads/${key}`;
  }

  async remove(key: string): Promise<void> {
    await unlink(path.join(this.root, key)).catch(() => {});
  }

  keyFromUrl(url: string): string | null {
    const m = /^https?:\/\/[^/]+\/uploads\/([A-Za-z0-9_\-./]+)$/.exec(url);
    return m && !m[1].includes("..") ? m[1] : null;
  }
}

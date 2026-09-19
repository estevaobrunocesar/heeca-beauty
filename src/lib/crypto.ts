import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Criptografia simétrica (AES-256-GCM) para segredos guardados no banco,
 * como o access token do provedor de pagamento de cada estabelecimento.
 * A chave deriva de AUTH_SECRET — trocar o segredo invalida os valores salvos.
 */
function key() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado");
  return createHash("sha256").update(s).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [iv, tag, data] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** "APP_USR-1234...-abcd" → "APP_USR-12…abcd" (para exibir sem vazar) */
export function maskSecret(s: string) {
  return s.length <= 10 ? "••••" : `${s.slice(0, 9)}…${s.slice(-4)}`;
}

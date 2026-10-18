import "server-only";
import { createHmac } from "node:crypto";

/**
 * Número de WhatsApp do próprio estabelecimento (canal próprio no Notify, D11).
 * Quem conecta é o portal (/conta/whatsapp, Embedded Signup); o Notify vincula o número a todos os
 * estabelecimentos da conta. Aqui só consultamos — o envio já passa `tenantId` e o Notify escolhe o remetente.
 */
export type TenantChannelState =
  | { via: "notify"; configured: true; fromPhone: string; active: boolean }
  | { via: "notify"; configured: false }
  | { via: "notify"; error: string }
  | { via: "outro" };

export async function getTenantChannel(tenantId: string): Promise<TenantChannelState> {
  if ((process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase() !== "notify") return { via: "outro" };
  const base = (process.env.NOTIFY_URL ?? "").replace(/\/+$/, "");
  const secret = process.env.NOTIFY_SECRET ?? "";
  if (!base || secret.length < 16) return { via: "notify", error: "NOTIFY_URL / NOTIFY_SECRET não configurados" };
  const ts = String(Date.now());
  const sig = createHmac("sha256", secret).update(`${ts}.`).digest("hex");
  try {
    const res = await fetch(`${base}/api/v1/channel?tenantId=${encodeURIComponent(tenantId)}`, {
      headers: { "X-Heeca-Product": process.env.NOTIFY_PRODUCT ?? "beauty", "X-Heeca-Timestamp": ts, "X-Heeca-Signature": sig, "User-Agent": "HeecaProduct/1.0 (+https://heeca.com.br)" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const j = (await res.json().catch(() => ({}))) as { configured?: boolean; fromPhone?: string; active?: boolean; error?: string };
    if (!res.ok) return { via: "notify", error: j.error ?? `Notify ${res.status}` };
    return j.configured && j.fromPhone ? { via: "notify", configured: true, fromPhone: j.fromPhone, active: j.active !== false } : { via: "notify", configured: false };
  } catch (e) {
    return { via: "notify", error: e instanceof Error ? e.message : String(e) };
  }
}

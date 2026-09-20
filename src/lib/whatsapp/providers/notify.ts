import { createHmac } from "node:crypto";
import type { OutboundMessage, ProviderHealth, SendResult, TemplateMessage, WhatsappProvider } from "../provider";

/**
 * Provedor "notify": o produto não fala com a Meta — manda a mensagem pronta ao Heeca Notify
 * (serviço central da plataforma), que entrega, tenta de novo e devolve status/respostas em
 * /api/notify/callback (mesmo formato de evento que a Meta mandaria).
 *
 * Variáveis: NOTIFY_URL (https://notify.heeca.com.br), NOTIFY_PRODUCT (slug do produto: beauty),
 * NOTIFY_SECRET (o mesmo NOTIFY_SECRET_<PRODUTO> do Notify), APP_URL (base do callback).
 */
export class HeecaNotifyProvider implements WhatsappProvider {
  readonly name = "notify";
  private readonly base: string;
  private readonly product: string;
  private readonly secret: string;
  private readonly callbackUrl: string;

  constructor(private readonly ctx: { tenantId: string; tenantName?: string; ref?: string } = { tenantId: "" }) {
    this.base = (process.env.NOTIFY_URL ?? "").replace(/\/+$/, "");
    this.product = process.env.NOTIFY_PRODUCT ?? "beauty";
    this.secret = process.env.NOTIFY_SECRET ?? "";
    this.callbackUrl = `${(process.env.APP_URL ?? "").replace(/\/+$/, "")}/api/notify/callback`;
    if (!this.base || this.secret.length < 16) throw new Error("NOTIFY_URL / NOTIFY_SECRET não configurados");
  }

  /** Mesma instância, outro contexto (o serviço de WhatsApp sabe o tenant e o agendamento). */
  withContext(ctx: { tenantId: string; tenantName?: string; ref?: string }) {
    return new HeecaNotifyProvider(ctx);
  }

  private async post(path: string, body: unknown) {
    const raw = JSON.stringify(body);
    const ts = String(Date.now());
    const sig = createHmac("sha256", this.secret).update(`${ts}.${raw}`).digest("hex");
    const res = await fetch(`${this.base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Heeca-Product": this.product, "X-Heeca-Timestamp": ts, "X-Heeca-Signature": sig, "User-Agent": "HeecaProduct/1.0 (+https://heeca.com.br)" }, body: raw, signal: AbortSignal.timeout(10_000) });
    const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; reason?: string; error?: string };
    if (!res.ok) throw new Error(`Notify ${res.status}: ${json.error ?? "erro"}`);
    return json;
  }

  private envelope(message: OutboundMessage | TemplateMessage, kind: "free" | "template") {
    return { tenantId: this.ctx.tenantId || "desconhecido", tenantName: this.ctx.tenantName, ref: this.ctx.ref, callbackUrl: this.callbackUrl, message: { kind, ...message } };
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const r = await this.post("/api/v1/messages", this.envelope(message, "free"));
    // O id do Notify é o "providerMessageId" do produto: os callbacks de status chegam com ele.
    if (r.status === "SKIPPED") throw new Error(`Notify não enviou: ${r.reason}`);
    return { providerMessageId: r.id };
  }

  async sendTemplate(message: TemplateMessage): Promise<SendResult> {
    const r = await this.post("/api/v1/messages", this.envelope(message, "template"));
    if (r.status === "SKIPPED") throw new Error(`Notify não enviou: ${r.reason}`);
    return { providerMessageId: r.id };
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const res = await fetch(`${this.base}/api/health`, { signal: AbortSignal.timeout(5_000) });
      const j = (await res.json()) as { ok?: boolean; provider?: string; status?: string };
      return j.ok ? { ok: true, verifiedName: `Heeca Notify (${j.provider}, ${j.status})` } : { ok: false, error: "Notify indisponível" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

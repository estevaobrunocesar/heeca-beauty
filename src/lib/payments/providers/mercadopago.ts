import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ChargeResult, CreateChargeInput, PixProvider, ProviderChargeStatus } from "../provider";

const API = "https://api.mercadopago.com";

/**
 * Mercado Pago — Pix via API de Pagamentos.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/integrate-with-pix
 *
 * Cada estabelecimento usa o próprio access token (o dinheiro cai direto na conta dele).
 */
export class MercadoPagoProvider implements PixProvider {
  readonly name = "mercadopago";

  constructor(private readonly accessToken: string) {
    if (!accessToken) throw new Error("Access token do Mercado Pago não configurado");
  }

  private async request<T>(path: string, init?: RequestInit & { idempotencyKey?: string }): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string; cause?: { description?: string }[] };
    if (!res.ok) {
      const detail = json.cause?.[0]?.description ?? json.message ?? `HTTP ${res.status}`;
      throw new Error(`Mercado Pago: ${detail}`);
    }
    return json;
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    // MP exige e-mail do pagador; sem e-mail usamos um endereço técnico derivado do telefone.
    const email = input.payer.email?.trim() || `${input.payer.phone.replace(/\D/g, "")}@cliente.heeca.app`;
    const [firstName, ...rest] = input.payer.name.trim().split(/\s+/);
    const body = {
      transaction_amount: Number((input.amountCents / 100).toFixed(2)),
      description: input.description.slice(0, 250),
      payment_method_id: "pix",
      external_reference: input.externalReference,
      date_of_expiration: toMpDate(input.expiresAt),
      ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
      payer: { email, first_name: firstName, last_name: rest.join(" ") || undefined },
    };
    const json = await this.request<MpPayment>("/v1/payments", {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey: `heeca-${input.externalReference}-${randomUUID()}`,
    });
    const tx = json.point_of_interaction?.transaction_data;
    return {
      providerPaymentId: String(json.id),
      copyPaste: tx?.qr_code ?? null,
      qrCodeBase64: tx?.qr_code_base64 ?? null,
      expiresAt: json.date_of_expiration ? new Date(json.date_of_expiration) : input.expiresAt,
    };
  }

  async getStatus(providerPaymentId: string): Promise<ProviderChargeStatus> {
    const json = await this.request<MpPayment>(`/v1/payments/${providerPaymentId}`);
    return mapStatus(json.status);
  }

  async refund(providerPaymentId: string, amountCents?: number): Promise<void> {
    await this.request(`/v1/payments/${providerPaymentId}/refunds`, {
      method: "POST",
      body: JSON.stringify(amountCents ? { amount: Number((amountCents / 100).toFixed(2)) } : {}),
      idempotencyKey: `heeca-refund-${providerPaymentId}-${randomUUID()}`,
    });
  }

  async healthCheck() {
    try {
      const me = await this.request<{ nickname?: string; email?: string; site_id?: string }>("/users/me");
      return { ok: true as const, account: [me.nickname, me.email, me.site_id].filter(Boolean).join(" · ") };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Webhook: a MP envia `{ action: "payment.updated", data: { id } }` (ou `?type=payment&data.id=`).
   * Retorna os ids de pagamento a reconsultar. A assinatura (x-signature) é validada quando
   * MERCADOPAGO_WEBHOOK_SECRET está definido.
   */
  static parseWebhook(url: URL, body: unknown, headers: Headers): string[] {
    const b = (body ?? {}) as { type?: string; action?: string; data?: { id?: string | number } };
    const type = url.searchParams.get("type") ?? b.type ?? b.action?.split(".")[0];
    const dataId = url.searchParams.get("data.id") ?? (b.data?.id != null ? String(b.data.id) : null);
    if (type !== "payment" || !dataId) return [];

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (secret) {
      const sig = headers.get("x-signature") ?? "";
      const ts = /ts=([^,]+)/.exec(sig)?.[1];
      const v1 = /v1=([^,]+)/.exec(sig)?.[1];
      const requestId = headers.get("x-request-id") ?? "";
      if (!ts || !v1) throw new Error("Assinatura ausente");
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const expected = createHmac("sha256", secret).update(manifest).digest("hex");
      if (expected.length !== v1.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) throw new Error("Assinatura inválida");
    }
    return [dataId];
  }
}

type MpPayment = {
  id: number;
  status: string;
  date_of_expiration?: string;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
};

function mapStatus(s: string): ProviderChargeStatus {
  switch (s) {
    case "approved": return "paid";
    case "refunded": case "charged_back": return "refunded";
    case "cancelled": return "expired"; // MP cancela automaticamente Pix expirado
    case "rejected": return "failed";
    default: return "pending"; // pending, in_process, authorized
  }
}

/** MP exige ISO 8601 com offset explícito (ex.: 2026-09-20T14:00:00.000-03:00). */
function toMpDate(d: Date): string {
  return d.toISOString().replace("Z", "-00:00");
}

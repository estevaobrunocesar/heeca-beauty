import { timingSafeEqual } from "node:crypto";
import type { ProviderChargeStatus } from "./provider";

// Regras puras do Asaas (API v3, https://docs.asaas.com): o provider em providers/asaas.ts só faz HTTP.
// Cada estabelecimento usa a PRÓPRIA conta Asaas (o sinal cai direto nela); a chave de API fica criptografada no tenant.

export const ASAAS_URLS = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
} as const;

/** `ASAAS_ENV=production` usa a API real; qualquer outro valor usa o sandbox. `ASAAS_API_URL` sobrescreve (só testes). */
export function asaasBaseUrl(env: string | undefined, override?: string): string {
  if (override) return override.replace(/\/$/, "");
  return env === "production" ? ASAAS_URLS.production : ASAAS_URLS.sandbox;
}

/** A API recebe valor em reais com 2 casas, não centavos. */
export const toAsaasValue = (cents: number) => Math.round(cents) / 100;

/** Datas do Asaas são AAAA-MM-DD e o vencimento nunca pode estar no passado. */
export function toAsaasDate(date: Date, now = new Date()): string {
  return (date.getTime() < now.getTime() ? now : date).toISOString().slice(0, 10);
}

/** Celular nacional (DDD + número) para o cadastro do cliente; null se não der para montar. */
export function asaasMobile(e164: string | null | undefined): string | null {
  const d = (e164 ?? "").replace(/\D/g, "");
  const nacional = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  return nacional.length === 10 || nacional.length === 11 ? nacional : null;
}

/** Status de cobrança do Asaas → status do nosso provedor Pix. */
export function statusFromAsaas(payment: { status?: string | null; deleted?: boolean | null }): ProviderChargeStatus {
  if (payment.deleted) return "cancelled";
  switch (payment.status) {
    case "RECEIVED": case "CONFIRMED": case "RECEIVED_IN_CASH": return "paid";
    case "REFUNDED": case "REFUND_REQUESTED": case "REFUND_IN_PROGRESS": return "refunded";
    case "OVERDUE": return "expired";
    default: return "pending"; // PENDING, AWAITING_RISK_ANALYSIS…
  }
}

export type AsaasPaymentBody = {
  customer: string; billingType: "PIX"; value: number; dueDate: string; description: string; externalReference: string;
};

/** Corpo de POST /payments: cobrança Pix do sinal (externalReference = id do agendamento). */
export function buildPixPaymentBody(
  input: { customerId: string; amountCents: number; expiresAt: Date; description: string; externalReference: string },
  now = new Date(),
): AsaasPaymentBody {
  return {
    customer: input.customerId, billingType: "PIX", value: toAsaasValue(input.amountCents),
    dueDate: toAsaasDate(input.expiresAt, now), description: input.description.slice(0, 500), externalReference: input.externalReference,
  };
}

/** O Asaas envia o token definido no painel de webhooks no header `asaas-access-token`. */
export function verifyWebhookToken(header: string | null, expected: string | null | undefined): boolean {
  if (!header || !expected) return false;
  const a = Buffer.from(header), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type AsaasWebhookBody = { id?: string; event?: string; payment?: { id?: string; externalReference?: string | null; status?: string } };

/** Eventos que valem uma reconsulta; o resto é ignorado. O payload nunca é a fonte da verdade: só o id da cobrança. */
const EVENTOS_UTEIS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_REFUND_IN_PROGRESS"]);
export function paymentIdFromWebhook(body: AsaasWebhookBody | null): string | null {
  if (!body?.event || !EVENTOS_UTEIS.has(body.event)) return null;
  return body.payment?.id ?? null;
}

/** Valida a chave informada (cola do painel): sem espaços e com tamanho plausível. */
export function cleanApiKey(raw: string): string | null {
  const k = raw.trim();
  return k.length >= 20 && !/\s/.test(k) ? k : null;
}

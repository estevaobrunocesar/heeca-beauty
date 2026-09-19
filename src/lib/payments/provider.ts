/**
 * Abstração de cobrança Pix. Implementações: MockPixProvider (dev) e MercadoPagoProvider.
 * Outros (Asaas, Efí, Stripe...) basta implementar esta interface.
 */

export type CreateChargeInput = {
  amountCents: number;
  description: string;
  externalReference: string; // id do agendamento
  expiresAt: Date;
  payer: { name: string; email?: string | null; phone: string };
  notificationUrl?: string;
};

export type ChargeResult = {
  providerPaymentId: string;
  copyPaste: string | null;   // código EMV "copia e cola"
  qrCodeBase64: string | null; // PNG em base64
  expiresAt: Date;
};

export type ProviderChargeStatus = "pending" | "paid" | "expired" | "cancelled" | "refunded" | "failed";

export interface PixProvider {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  getStatus(providerPaymentId: string): Promise<ProviderChargeStatus>;
  refund(providerPaymentId: string, amountCents?: number): Promise<void>;
  /** Verifica credenciais; usado em Configurações → Pagamentos. */
  healthCheck(): Promise<{ ok: true; account?: string } | { ok: false; error: string }>;
}

/**
 * Abstração de cobrança Pix. Implementações: AsaasPixProvider (o único meio de pagamento da Heeca) e MockPixProvider (só desenvolvimento).
 */

export type CreateChargeInput = {
  amountCents: number;
  description: string;
  externalReference: string; // id do agendamento
  expiresAt: Date;
  payer: { id: string; name: string; email?: string | null; phone: string; cpf?: string | null };
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
  /** Cancela uma cobrança ainda não paga, para ninguém pagar um sinal já expirado. */
  cancel?(providerPaymentId: string): Promise<void>;
  /** Verifica credenciais; usado em Configurações → Pagamentos. */
  healthCheck(): Promise<{ ok: true; account?: string } | { ok: false; error: string }>;
}

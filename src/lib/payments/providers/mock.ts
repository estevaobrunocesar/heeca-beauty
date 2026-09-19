import type { ChargeResult, CreateChargeInput, PixProvider, ProviderChargeStatus } from "../provider";

/**
 * Provedor de desenvolvimento: gera um "Pix" fictício. O pagamento é simulado
 * pelo botão "Simular pagamento" da página de pagamento (POST /api/dev/mock-pay).
 * O status vive no banco (Payment.status); aqui não há estado.
 */
export class MockPixProvider implements PixProvider {
  readonly name = "mock";

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const amount = (input.amountCents / 100).toFixed(2);
    // Formato lembra um EMV real, mas é inválido de propósito.
    const copyPaste = `00020126580014BR.GOV.BCB.PIX0136MOCK-${input.externalReference}52040000530398654${String(amount.length).padStart(2, "0")}${amount}5802BR5905HEECA6009SAO PAULO62070503***6304MOCK`;
    return { providerPaymentId: id, copyPaste, qrCodeBase64: null, expiresAt: input.expiresAt };
  }

  async getStatus(): Promise<ProviderChargeStatus> {
    return "pending"; // a fonte da verdade no mock é o banco
  }

  async refund(): Promise<void> {
    /* nada a fazer */
  }

  async healthCheck() {
    return { ok: true as const, account: "Modo de desenvolvimento (mock)" };
  }
}

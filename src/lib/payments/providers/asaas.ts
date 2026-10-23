import type { ChargeResult, CreateChargeInput, PixProvider, ProviderChargeStatus } from "../provider";
import { asaasBaseUrl, asaasMobile, buildPixPaymentBody, statusFromAsaas, toAsaasValue } from "../asaas-rules";
import { onlyCpfDigits } from "@/lib/cpf";

type AsaasError = { errors?: { code: string; description: string }[] };
type AsaasCustomer = { id: string };
type AsaasPayment = { id: string; status?: string; deleted?: boolean };
type AsaasPixQr = { encodedImage?: string; payload?: string; expirationDate?: string };

/**
 * Asaas (Pix) via REST, sem SDK. Cada estabelecimento usa a PRÓPRIA conta: o sinal cai direto nela.
 *  - Cliente Asaas por cliente do estabelecimento (externalReference = Client.id); o Asaas exige CPF/CNPJ para emitir cobrança.
 *  - Cada sinal = uma cobrança avulsa com billingType PIX (externalReference = id do agendamento); o QR Code e o "copia e cola"
 *    vêm de GET /payments/{id}/pixQrCode.
 *  - O Asaas não avisa a cliente (notificationDisabled): a confirmação é nossa, pelo WhatsApp.
 * Ambiente: ASAAS_ENV=production usa a API real; senão sandbox (ver asaas-rules.ts).
 */
export class AsaasPixProvider implements PixProvider {
  readonly name = "asaas";
  private readonly base: string;

  constructor(private readonly apiKey: string, base?: string) {
    if (!apiKey) throw new Error("Chave de API do Asaas não configurada");
    this.base = base ?? asaasBaseUrl(process.env.ASAAS_ENV, process.env.ASAAS_API_URL);
  }

  private async call<T>(path: string, init: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { access_token: this.apiKey, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "HeecaSchedule/1.0" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as T & AsaasError;
    if (!res.ok) {
      const detail = json.errors?.map((e) => e.description).join("; ") || (res.status === 401 ? "chave de API inválida" : res.statusText);
      throw new Error(`Asaas: ${detail}`);
    }
    return json;
  }

  /** Cliente no Asaas: reaproveita pelo id da nossa cliente; senão cria (CPF obrigatório). */
  private async ensureCustomer(payer: CreateChargeInput["payer"]): Promise<string> {
    const found = await this.call<{ data?: AsaasCustomer[] }>(`/customers?externalReference=${encodeURIComponent(payer.id)}&limit=1`);
    if (found.data?.[0]?.id) return found.data[0].id;
    const cpfCnpj = onlyCpfDigits(payer.cpf);
    if (!cpfCnpj) throw new Error("Informe o CPF da cliente para gerar o Pix.");
    const mobile = asaasMobile(payer.phone);
    const c = await this.call<AsaasCustomer>("/customers", {
      body: {
        name: payer.name, cpfCnpj, externalReference: payer.id, notificationDisabled: true,
        ...(payer.email ? { email: payer.email } : {}), ...(mobile ? { mobilePhone: mobile } : {}),
      },
    });
    return c.id;
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const customerId = await this.ensureCustomer(input.payer);
    const payment = await this.call<AsaasPayment>("/payments", { body: buildPixPaymentBody({ customerId, ...input }) });
    const qr = await this.call<AsaasPixQr>(`/payments/${payment.id}/pixQrCode`);
    return { providerPaymentId: payment.id, copyPaste: qr.payload ?? null, qrCodeBase64: qr.encodedImage ?? null, expiresAt: input.expiresAt };
  }

  async getStatus(providerPaymentId: string): Promise<ProviderChargeStatus> {
    return statusFromAsaas(await this.call<AsaasPayment>(`/payments/${providerPaymentId}`));
  }

  async refund(providerPaymentId: string, amountCents?: number): Promise<void> {
    await this.call(`/payments/${providerPaymentId}/refund`, { body: amountCents ? { value: toAsaasValue(amountCents) } : {} });
  }

  /** Cancela uma cobrança ainda não paga (sinal expirado ou agendamento cancelado), para ninguém pagar depois. */
  async cancel(providerPaymentId: string): Promise<void> {
    await this.call(`/payments/${providerPaymentId}`, { method: "DELETE" });
  }

  async healthCheck() {
    try {
      await this.call("/customers?limit=1");
      return { ok: true as const, account: this.base.includes("sandbox") ? "Asaas conectado (ambiente de testes)" : "Asaas conectado" };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

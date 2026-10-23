import "server-only";
import type { Tenant } from "@/generated/prisma/client";
import { decryptSecret } from "@/lib/crypto";
import type { PixProvider } from "./provider";
import { MockPixProvider } from "./providers/mock";
import { AsaasPixProvider } from "./providers/asaas";

type TenantPix = Pick<Tenant, "pixProvider" | "pixCredentialsEnc">;

/** O único provedor de pagamento da Heeca é o Asaas. O "mock" existe só para desenvolvimento (PIX_PROVIDER=mock no ambiente). */
export type PixProviderName = "asaas" | "mock" | "none";

const valido = (v: string | null | undefined): "asaas" | "mock" | null => {
  const n = (v ?? "").toLowerCase();
  return n === "asaas" || n === "mock" ? n : null;
};

/** Provedor efetivo do estabelecimento: o dele, senão o padrão do ambiente; qualquer outro valor = sem Pix configurado. */
export function pixProviderName(tenant: TenantPix): PixProviderName {
  return valido(tenant.pixProvider) ?? valido(process.env.PIX_PROVIDER) ?? "none";
}

export class PixNotConfiguredError extends Error {
  constructor(message = "O Pix ainda não está configurado. Informe a chave de API do Asaas em Configurações → Pagamentos.") {
    super(message);
  }
}

/** Provedor de Pix do estabelecimento (a chave do Asaas é dele, criptografada no banco). Lança PixNotConfiguredError se faltar. */
export function getPixProvider(tenant: TenantPix): PixProvider {
  const name = pixProviderName(tenant);
  if (name === "mock") return new MockPixProvider();
  if (name === "asaas") {
    if (!tenant.pixCredentialsEnc) throw new PixNotConfiguredError("Informe a chave de API do Asaas em Configurações → Pagamentos.");
    return new AsaasPixProvider(decryptSecret(tenant.pixCredentialsEnc));
  }
  throw new PixNotConfiguredError();
}

/** Instancia um provedor a partir de uma chave ainda não salva (para testar antes de gravar). */
export function pixProviderFor(name: "asaas" | "mock", apiKey: string): PixProvider {
  return name === "asaas" ? new AsaasPixProvider(apiKey) : new MockPixProvider();
}

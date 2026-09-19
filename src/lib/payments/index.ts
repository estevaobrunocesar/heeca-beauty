import "server-only";
import type { Tenant } from "@/generated/prisma/client";
import { decryptSecret } from "@/lib/crypto";
import type { PixProvider } from "./provider";
import { MockPixProvider } from "./providers/mock";
import { MercadoPagoProvider } from "./providers/mercadopago";

type TenantPix = Pick<Tenant, "pixProvider" | "pixCredentialsEnc">;

/** Nome do provedor efetivo para um estabelecimento (configuração dele ou padrão do ambiente). */
export function pixProviderName(tenant: TenantPix): string {
  return (tenant.pixProvider ?? process.env.PIX_PROVIDER ?? "mock").toLowerCase();
}

/**
 * Provedor de Pix do estabelecimento. Credenciais vêm do tenant (criptografadas)
 * ou, como fallback de desenvolvimento/plataforma, de MERCADOPAGO_ACCESS_TOKEN.
 */
export function getPixProvider(tenant: TenantPix): PixProvider {
  const name = pixProviderName(tenant);
  if (name === "mercadopago") {
    const token = tenant.pixCredentialsEnc ? decryptSecret(tenant.pixCredentialsEnc) : process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
    return new MercadoPagoProvider(token);
  }
  return new MockPixProvider();
}

/** Instancia um provedor a partir de credenciais ainda não salvas (para testar antes de gravar). */
export function pixProviderFor(name: string, accessToken: string): PixProvider {
  if (name === "mercadopago") return new MercadoPagoProvider(accessToken);
  return new MockPixProvider();
}

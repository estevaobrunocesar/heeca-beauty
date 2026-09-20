import "server-only";
import { headers } from "next/headers";
import { MARCA_PADRAO, marcaDoHost, marcaPorSlug, segmentosDe, fichaDe, type Marca } from "@/lib/marca";

/** Marca do host desta requisição (páginas de entrada: login, SSO, provisionamento). */
export async function marcaAtual(): Promise<Marca> {
  const h = await headers();
  return marcaDoHost(h.get("x-forwarded-host") ?? h.get("host"));
}

/**
 * URL pública de uma marca. Em produção APP_URL_TEMPLATE=https://{marca}.heeca.com.br;
 * sem template, APP_URL vale para todas (dev: um host só).
 */
export function appUrlDe(marca: Marca | string): string {
  const slug = typeof marca === "string" ? marca : marca.slug;
  const template = process.env.APP_URL_TEMPLATE;
  const base = template ? template.replace("{marca}", slug) : (process.env.APP_URL ?? "http://localhost:3000");
  return base.replace(/\/+$/, "");
}

export const marcaDoTenant = (tenant: { marca: string }): Marca => marcaPorSlug(tenant.marca ?? MARCA_PADRAO);

/** Marca, segmentos ativos e ficha do estabelecimento — o que quase toda página do painel precisa. */
export function perfilDoTenant(tenant: { marca: string; segmentos: string[] }) {
  const marca = marcaDoTenant(tenant);
  const segmentos = segmentosDe(marca, tenant);
  return { marca, segmentos, ficha: fichaDe(segmentos) };
}

/**
 * Trava de isolamento: cada produto é individual — um estabelecimento só é servido pelo host da
 * SUA marca. Em produção cada marca tem container e banco próprios (MARCA_DEFAULT), então isto
 * nunca dispara; é defesa em profundidade para dev (um host serve todas) e para erro de DNS/config.
 */
export async function mesmaMarcaDoHost(tenant: { marca: string }): Promise<boolean> {
  return (await marcaAtual()).slug === (tenant.marca ?? MARCA_PADRAO);
}

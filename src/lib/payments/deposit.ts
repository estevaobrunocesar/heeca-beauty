import type { DepositMode } from "@/generated/prisma/enums";

/** Abaixo disso não vale cobrar sinal (limite prático do Pix e das taxas). */
export const MIN_DEPOSIT_CENTS = 100;

/**
 * Valor do sinal para um serviço, conforme a configuração do estabelecimento.
 * Retorna 0 quando não há cobrança (modo NONE, valor irrisório ou preço zero).
 *  - PERCENT: X% do preço, arredondado para o centavo;
 *  - FIXED: valor fixo, nunca maior que o preço do serviço.
 */
export function computeDepositCents(tenant: { depositMode: DepositMode; depositValue: number }, priceCents: number): number {
  if (priceCents <= 0) return 0;
  let cents = 0;
  if (tenant.depositMode === "PERCENT") cents = Math.round((priceCents * Math.min(100, Math.max(0, tenant.depositValue))) / 100);
  else if (tenant.depositMode === "FIXED") cents = Math.min(tenant.depositValue, priceCents);
  return cents >= MIN_DEPOSIT_CENTS ? cents : 0;
}

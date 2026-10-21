// Fidelidade (cashback). Puro: o saldo é a soma dos lançamentos, nunca um número gravado.

export const MAX_PERCENT = 50;
export const saldoDoCashback = (entradas: { amountCents: number }[]) => entradas.reduce((n, e) => n + e.amountCents, 0);

/** Crédito de um atendimento: % dos serviços (sem valores adicionais), arredondado para baixo. */
export function cashbackGanho(servicosCents: number, percent: number): number {
  if (percent <= 0 || servicosCents <= 0) return 0;
  return Math.floor((servicosCents * Math.min(percent, MAX_PERCENT)) / 100);
}

/**
 * Quanto falta creditar para o atendimento ter o cashback esperado. `jaCreditado` é o líquido (EARN − REVERSAL).
 * Idempotente: concluir de novo não credita de novo; um serviço acrescentado depois credita só a diferença.
 */
export const creditoPendente = (esperado: number, jaCreditado: number) => Math.max(0, esperado - jaCreditado);

export type UsoValidado = { ok: true; valorCents: number } | { ok: false; error: string };

/** O uso do saldo precisa ser maior que zero e não passar do saldo da cliente. */
export function validarUso(valorCents: number | null, saldoCents: number): UsoValidado {
  if (valorCents == null || valorCents <= 0) return { ok: false, error: "Informe o valor a usar, maior que zero." };
  if (valorCents > saldoCents) return { ok: false, error: "A cliente só tem esse valor de saldo disponível." };
  return { ok: true, valorCents };
}

export function validarPercentual(v: number): { ok: true; percent: number } | { ok: false; error: string } {
  if (!Number.isInteger(v) || v < 0 || v > MAX_PERCENT) return { ok: false, error: `Use um número inteiro de 0 a ${MAX_PERCENT}.` };
  return { ok: true, percent: v };
}

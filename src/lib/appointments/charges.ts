import { parseMoneyToCents } from "@/lib/money";

// Valores adicionais do atendimento (produtos usados, material extra), lançados ao concluir.
// Puro: a tela usa para mostrar o total e a action para validar antes de gravar.

export const MAX_CHARGES = 10;
export const MAX_CHARGE_CENTS = 100_000 * 100; // R$ 100.000: acima disso é erro de digitação

export type ExtraInput = { description: string; amount: string };
export type Extra = { description: string; amountCents: number };

/**
 * Linhas vazias (sem descrição e sem valor) são ignoradas. Cada linha preenchida precisa de descrição e de um valor
 * maior que zero; um valor sem descrição (ou o contrário) é erro, para não gravar cobrança sem explicação.
 */
export function parseExtras(lines: ExtraInput[]): { ok: true; extras: Extra[] } | { ok: false; error: string } {
  const extras: Extra[] = [];
  for (const line of lines) {
    const description = line.description.trim();
    const amountText = line.amount.trim();
    if (!description && !amountText) continue;
    if (!description) return { ok: false, error: "Descreva o valor adicional (ex.: tinta extra, ampola)." };
    if (description.length > 120) return { ok: false, error: "A descrição do valor adicional é longa demais (máximo 120 caracteres)." };
    const amountCents = amountText ? parseMoneyToCents(amountText) : null;
    if (amountCents == null || amountCents <= 0) return { ok: false, error: `Informe um valor maior que zero para "${description}".` };
    if (amountCents > MAX_CHARGE_CENTS) return { ok: false, error: `O valor de "${description}" está alto demais. Confira.` };
    extras.push({ description, amountCents });
  }
  if (extras.length > MAX_CHARGES) return { ok: false, error: `No máximo ${MAX_CHARGES} valores adicionais por atendimento.` };
  return { ok: true, extras };
}

export const totalExtras = (extras: { amountCents: number }[]) => extras.reduce((n, e) => n + e.amountCents, 0);

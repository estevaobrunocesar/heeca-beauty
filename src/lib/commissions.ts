import { parseMoneyToCents } from "@/lib/money";

/**
 * Comissões (SPEC §17). Função pura: usada ao concluir a visita e nos relatórios.
 *
 * Cada serviço tem uma comissão por profissional, combinada com o dono (o "acordo", em `ProfessionalService`), e uma
 * tabela padrão para todos (`Service.commission*`). Na ordem de precedência:
 *  1. acordo do profissional neste serviço: valor fixo, depois percentual;
 *  2. tabela padrão do serviço: valor fixo, depois percentual;
 *  3. nada configurado → `null` (não comissionado, ex.: dono do salão).
 * A comissão geral antiga do profissional (`Professional.commissionPercent`) não entra mais.
 *
 * Base do percentual: o preço do item já com os adicionais (o profissional executou os dois).
 * O sinal pago via Pix não altera a base — é só antecipação do mesmo valor.
 * Arredondamento: meio para cima, em centavos.
 */
export type CommissionTerms = { percent?: number | null; fixedCents?: number | null };
export type CommissionRule = { agreement?: CommissionTerms; standard?: CommissionTerms };

function termsToCents(priceCents: number, t: CommissionTerms | undefined): number | null {
  if (!t) return null;
  if (t.fixedCents != null) return Math.max(0, t.fixedCents);
  if (t.percent == null) return null;
  return Math.round((priceCents * Math.min(100, Math.max(0, t.percent))) / 100);
}

export function commissionCentsFor(priceCents: number, rule: CommissionRule): number | null {
  return termsToCents(priceCents, rule.agreement) ?? termsToCents(priceCents, rule.standard);
}

/**
 * Lê um campo de comissão do formulário: tipo ("pct" | "brl") + valor digitado.
 * Vazio = sem comissão própria (herda). Devolve null se o valor for inválido.
 */
export function parseCommissionField(kind: string, raw: string): CommissionTerms | null {
  const text = raw.trim();
  if (text === "") return {};
  if (kind === "brl") {
    const cents = parseMoneyToCents(text);
    return cents == null ? null : { fixedCents: cents };
  }
  if (!/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return n <= 100 ? { percent: n } : null;
}

/** Como a comissão aparece na tela: "40%", "R$ 25,00" ou "—". */
export function describeCommission(t: CommissionTerms | undefined | null, formatCents: (c: number) => string): string {
  if (t?.fixedCents != null) return formatCents(t.fixedCents);
  if (t?.percent != null) return `${t.percent}%`;
  return "—";
}

/** Totais de um conjunto de itens concluídos (para o painel do profissional e o fechamento do salão). */
export function summarizeCommissions(items: { priceCents: number; commissionCents: number | null; commissionPaidAt: Date | null }[]) {
  let revenueCents = 0, commissionCents = 0, paidCents = 0, pendingCents = 0, count = 0;
  for (const it of items) {
    count++;
    revenueCents += it.priceCents;
    const c = it.commissionCents ?? 0;
    commissionCents += c;
    if (it.commissionPaidAt) paidCents += c; else pendingCents += c;
  }
  return { count, revenueCents, commissionCents, paidCents, pendingCents };
}

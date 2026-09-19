/**
 * Comissões (SPEC §17). Função pura: usada ao concluir a visita e nos relatórios.
 *
 * Regras, na ordem de precedência:
 *  1. valor fixo por execução no par profissional×serviço (`ProfessionalService.commissionFixedCents`);
 *  2. percentual no par profissional×serviço (`ProfessionalService.commissionPercent`);
 *  3. percentual padrão do profissional (`Professional.commissionPercent`);
 *  4. nada configurado → `null` (não comissionado, ex.: dono do salão).
 *
 * Base do percentual: o preço do item já com os adicionais (o profissional executou os dois).
 * O sinal pago via Pix não altera a base — é só antecipação do mesmo valor.
 * Arredondamento: meio para cima, em centavos.
 */
export type CommissionRule = {
  professionalPercent: number | null;
  overridePercent?: number | null;
  overrideFixedCents?: number | null;
};

export function commissionCentsFor(priceCents: number, rule: CommissionRule): number | null {
  if (rule.overrideFixedCents != null) return Math.max(0, rule.overrideFixedCents);
  const percent = rule.overridePercent ?? rule.professionalPercent;
  if (percent == null) return null;
  const clamped = Math.min(100, Math.max(0, percent));
  return Math.round((priceCents * clamped) / 100);
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

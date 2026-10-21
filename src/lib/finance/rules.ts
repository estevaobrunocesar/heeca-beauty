// Financeiro e caixa. Puro: telas e exportações usam as mesmas contas.

export const METHODS = ["CASH", "PIX", "DEBIT", "CREDIT", "OTHER"] as const;
export type Method = (typeof METHODS)[number];
export const METHOD_LABEL: Record<Method, string> = { CASH: "Dinheiro", PIX: "Pix", DEBIT: "Débito", CREDIT: "Crédito", OTHER: "Outro" };
export const NAO_INFORMADO = "Não informado";

export const EXPENSE_CATEGORIES = ["Aluguel e contas", "Produtos e materiais", "Equipe", "Marketing", "Impostos e taxas", "Manutenção", "Outros"] as const;

export const isMethod = (v: unknown): v is Method => typeof v === "string" && (METHODS as readonly string[]).includes(v);

export type Receita = { cents: number; method: Method | null };
export type Despesa = { cents: number; category: string; method: Method };

const somaPor = <T>(itens: T[], chave: (t: T) => string, valor: (t: T) => number) => {
  const m = new Map<string, number>();
  for (const i of itens) m.set(chave(i), (m.get(chave(i)) ?? 0) + valor(i));
  return [...m.entries()].map(([nome, cents]) => ({ nome, cents })).sort((a, b) => b.cents - a.cents);
};

/** Entradas por forma de pagamento, saídas por categoria e o resultado (receita − despesa) do período. */
export function resumoFinanceiro(receitas: Receita[], despesas: Despesa[]) {
  const receitaCents = receitas.reduce((n, r) => n + r.cents, 0);
  const despesaCents = despesas.reduce((n, d) => n + d.cents, 0);
  return {
    receitaCents, despesaCents, resultadoCents: receitaCents - despesaCents,
    margem: receitaCents > 0 ? (receitaCents - despesaCents) / receitaCents : null,
    porForma: somaPor(receitas, (r) => (r.method ? METHOD_LABEL[r.method] : NAO_INFORMADO), (r) => r.cents),
    porCategoria: somaPor(despesas, (d) => d.category, (d) => d.cents),
  };
}

export type CaixaEntrada = {
  openingCents: number;
  /** Atendimentos pagos em dinheiro concluídos com o caixa aberto. */
  recebidoDinheiroCents: number;
  /** Despesas em dinheiro pagas com o caixa aberto. */
  despesasDinheiroCents: number;
  suprimentoCents: number;
  sangriaCents: number;
};

/** Dinheiro que deveria estar na gaveta: troco inicial + recebido em dinheiro + suprimentos − despesas em dinheiro − sangrias. */
export const caixaEsperado = (c: CaixaEntrada) =>
  c.openingCents + c.recebidoDinheiroCents + c.suprimentoCents - c.despesasDinheiroCents - c.sangriaCents;

/** Diferença da contagem: positivo = sobra, negativo = falta. */
export const diferencaDoCaixa = (contadoCents: number, esperadoCents: number) => contadoCents - esperadoCents;

export function rotuloDoCaixa(diferencaCents: number): "confere" | "sobra" | "falta" {
  return diferencaCents === 0 ? "confere" : diferencaCents > 0 ? "sobra" : "falta";
}

/** Dia (DateKey) → instante de gravação da despesa: meio-dia UTC, que cai no mesmo dia em qualquer fuso do Brasil. */
export const diaDaDespesa = (dateKey: string) => new Date(`${dateKey}T12:00:00.000Z`);
export const chaveDaDespesa = (d: Date) => d.toISOString().slice(0, 10);

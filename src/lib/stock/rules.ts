// Regras do estoque. Puras: o saldo nunca é gravado, é a soma das movimentações.
// Quantidades são inteiros na unidade do produto (un, ml, g).

export const UNITS = ["un", "ml", "g"] as const;
export type Unit = (typeof UNITS)[number];
export const UNIT_LABEL: Record<Unit, string> = { un: "unidades", ml: "ml", g: "g" };

export type MovementKind = "PURCHASE" | "USAGE" | "RETURN" | "LOSS" | "ADJUSTMENT";
export const KIND_LABEL: Record<MovementKind, string> = {
  PURCHASE: "Entrada", USAGE: "Uso em atendimento", RETURN: "Estorno de atendimento", LOSS: "Saída", ADJUSTMENT: "Acerto de inventário",
};

export const MAX_QUANTITY = 1_000_000;

export const saldoDe = (movs: { quantity: number }[]) => movs.reduce((n, m) => n + m.quantity, 0);

export type Situacao = "ok" | "baixo" | "zerado" | "negativo";

/** `min` 0 = sem alerta de mínimo (só zerado/negativo avisam). Igual ao mínimo já é "baixo". */
export function situacaoDe(saldo: number, min: number): Situacao {
  if (saldo < 0) return "negativo";
  if (saldo === 0) return "zerado";
  if (min > 0 && saldo <= min) return "baixo";
  return "ok";
}
export const precisaReposicao = (s: Situacao) => s !== "ok";

/** Inteiro positivo digitado pela pessoa ("1.500" e "1500" valem igual). */
export function parseQuantidade(input: string | number): number | null {
  const n = typeof input === "number" ? input : Number(input.trim().replace(/\./g, "").replace(",", "."));
  if (!Number.isInteger(n) || n < 0 || n > MAX_QUANTITY) return null;
  return n;
}

export type ManualInput = { kind: "PURCHASE" | "LOSS" | "ADJUSTMENT"; quantity: number; saldoAtual: number };

/**
 * Movimentação manual → quantidade com sinal a gravar.
 *  - Entrada: soma. Saída: subtrai e não pode passar do saldo (saldo negativo só nasce da baixa automática).
 *  - Acerto: `quantity` é a CONTAGEM real; grava a diferença para o saldo bater com ela.
 */
export function movimentoManual({ kind, quantity, saldoAtual }: ManualInput): { ok: true; delta: number } | { ok: false; error: string } {
  if (kind === "ADJUSTMENT") {
    const delta = quantity - saldoAtual;
    if (delta === 0) return { ok: false, error: "A contagem é igual ao saldo atual; não há o que acertar." };
    return { ok: true, delta };
  }
  if (quantity <= 0) return { ok: false, error: "Informe uma quantidade maior que zero." };
  if (kind === "LOSS") {
    if (quantity > saldoAtual) return { ok: false, error: `Só há ${saldoAtual} em estoque. Para corrigir o saldo, use "Acertar contagem".` };
    return { ok: true, delta: -quantity };
  }
  return { ok: true, delta: quantity };
}

/** Consumo de um atendimento: soma, por produto, a receita de cada serviço feito (um item = uma vez a receita). */
export function usoDoAtendimento(
  itens: { serviceId: string }[],
  receitas: { serviceId: string; productId: string; quantity: number }[],
): Map<string, number> {
  const uso = new Map<string, number>();
  for (const item of itens) {
    for (const r of receitas) {
      if (r.serviceId === item.serviceId && r.quantity > 0) uso.set(r.productId, (uso.get(r.productId) ?? 0) + r.quantity);
    }
  }
  return uso;
}

/**
 * Baixa idempotente: o que falta baixar para o atendimento ficar com o consumo esperado. `jaBaixado` é o líquido já
 * gravado (USAGE − RETURN, positivo = quanto já saiu). Concluir duas vezes não baixa duas vezes.
 */
export function baixaPendente(esperado: Map<string, number>, jaBaixado: Map<string, number>): Map<string, number> {
  const falta = new Map<string, number>();
  for (const [produto, qtd] of esperado) {
    const resto = qtd - (jaBaixado.get(produto) ?? 0);
    if (resto > 0) falta.set(produto, resto);
  }
  return falta;
}

/** Estorno ao reabrir: devolve tudo que já saiu daquele atendimento (líquido positivo). */
export function estornoPendente(jaBaixado: Map<string, number>): Map<string, number> {
  const volta = new Map<string, number>();
  for (const [produto, qtd] of jaBaixado) if (qtd > 0) volta.set(produto, qtd);
  return volta;
}

/** Valor em estoque a custo; produtos sem custo ou com saldo negativo não entram. */
export function valorEmEstoqueCents(produtos: { saldo: number; costCents: number | null }[]) {
  return produtos.reduce((n, p) => n + (p.costCents != null && p.saldo > 0 ? p.saldo * p.costCents : 0), 0);
}

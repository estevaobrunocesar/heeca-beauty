/**
 * Módulo clínico (opção do segmento Estética) — regras puras, sem banco; testes em tests/treatments.test.ts.
 * Portado do Heeca Skin: o "plano de tratamento" do Skin é o `ClientPackage` do Beauty (consumo e saldo
 * em lib/packages/rules.ts); aqui ficam só as regras que o pacote não tinha.
 */
import type { PlanPaymentMethod } from "@/generated/prisma/enums";

const DIA = 86_400_000;

/**
 * O módulo clínico (avaliações, protocolos, evolução, recebimentos do plano) aparece para quem atende
 * Estética. `segmentos` vazio = o estabelecimento ainda não escolheu → o painel trata como "todos" (mesma
 * regra do resto do motor), então o módulo aparece e ele decide depois.
 */
export function moduloClinicoAtivo(segmentos: string[]): boolean {
  return segmentos.length === 0 || segmentos.includes("estetica");
}

/**
 * Data sugerida para a próxima sessão: última realizada + intervalo do plano. Sem intervalo ou sem sessão
 * realizada, sugere hoje (o profissional decide). Nunca sugere o passado.
 */
export function sugerirProximaSessao(intervalDays: number | null, ultimaRealizada: Date | null, agora = new Date()): Date {
  if (!intervalDays || intervalDays <= 0 || !ultimaRealizada) return agora;
  const sugerida = new Date(ultimaRealizada.getTime() + intervalDays * DIA);
  return sugerida.getTime() < agora.getTime() ? agora : sugerida;
}

export type ResumoPagamentos = {
  /** Soma dos recebimentos registrados. */
  pagoCents: number;
  /** Quanto falta receber (nunca negativo). */
  saldoCents: number;
  /** Recebido além do valor do plano (ex.: preço reduzido depois do pagamento) — aparece como alerta. */
  excedenteCents: number;
  quitado: boolean;
};

/** Valor do plano × recebimentos: "pago R$ 300 de R$ 450 → saldo R$ 150". */
export function resumoPagamentos(priceCents: number, pagamentos: { amountCents: number }[]): ResumoPagamentos {
  const pagoCents = pagamentos.reduce((s, p) => s + p.amountCents, 0);
  return {
    pagoCents,
    saldoCents: Math.max(0, priceCents - pagoCents),
    excedenteCents: Math.max(0, pagoCents - priceCents),
    quitado: priceCents > 0 && pagoCents >= priceCents,
  };
}

export const FORMAS_PAGAMENTO: PlanPaymentMethod[] = ["PIX", "CASH", "CREDIT", "DEBIT", "TRANSFER"];
export const ROTULO_FORMA: Record<PlanPaymentMethod, string> = { PIX: "Pix", CASH: "Dinheiro", CREDIT: "Crédito", DEBIT: "Débito", TRANSFER: "Transferência" };

/** Etapas do protocolo na ordem; a sessão N sugere a etapa N (cicla se houver mais sessões que etapas). */
export function etapaSugerida<T>(etapas: T[], sessoesRealizadas: number): T | null {
  if (etapas.length === 0) return null;
  return etapas[sessoesRealizadas % etapas.length];
}

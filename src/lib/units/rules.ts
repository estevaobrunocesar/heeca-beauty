// Múltiplas unidades. Puro: quem e o que vale em cada unidade.

/** Sem unidade escolhida (null) tudo vale; profissional/sala sem unidade (null) valem em qualquer unidade. */
export function valeNaUnidade(unidadeDoItem: string | null | undefined, unidadeEscolhida: string | null | undefined): boolean {
  if (!unidadeEscolhida) return true;
  if (!unidadeDoItem) return true;
  return unidadeDoItem === unidadeEscolhida;
}

/** A cliente só precisa escolher a unidade quando há duas ou mais ativas. */
export const exigeEscolhaDeUnidade = (unidadesAtivas: number) => unidadesAtivas >= 2;

/**
 * Unidade de uma visita: a escolhida; senão a única unidade em que todos os profissionais com unidade atendem.
 * Profissionais sem unidade não decidem. Se houver mais de uma, a do primeiro serviço manda.
 */
export function unidadeDaVisita(escolhida: string | null | undefined, unidadesDosProfissionais: (string | null)[]): string | null {
  if (escolhida) return escolhida;
  return unidadesDosProfissionais.find((u) => u != null) ?? null;
}

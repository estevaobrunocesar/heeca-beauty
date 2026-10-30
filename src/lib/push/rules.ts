/** Regras puras dos avisos para o celular das profissionais (sem banco nem rede). */

export type TipoAviso = "NOVO_AGENDAMENTO" | "CANCELAMENTO";

export type DadosAviso = { cliente: string; servico: string; quando: string }; // quando: "qui, 29/10 às 14:00" (já no fuso do estabelecimento)

export function mensagemDoAviso(tipo: TipoAviso, d: DadosAviso): { titulo: string; corpo: string } {
  const quem = d.cliente.trim() || "Cliente";
  if (tipo === "CANCELAMENTO") return { titulo: "Agendamento cancelado", corpo: `${quem} cancelou ${d.servico} de ${d.quando}.` };
  return { titulo: "Novo agendamento", corpo: `${quem} · ${d.servico} · ${d.quando}` };
}

/** Quem recebe: só as pessoas com login ligadas aos itens da visita, uma vez cada. */
export function usuariosDoAviso(itens: { professional: { userId: string | null } }[]): string[] {
  return [...new Set(itens.map((i) => i.professional.userId).filter((u): u is string => !!u))];
}

/** O que o app abre ao tocar no aviso: a agenda no dia do atendimento. */
export function destinoDoAviso(dateKey: string): string {
  return `/app/agenda?date=${dateKey}`;
}

export const PLATAFORMAS = ["android", "ios"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

/** Token do FCM: string longa sem espaços. Recusa lixo antes de gravar. */
export function tokenValido(token: unknown): token is string {
  return typeof token === "string" && token.length >= 20 && token.length <= 4096 && !/\s/.test(token);
}

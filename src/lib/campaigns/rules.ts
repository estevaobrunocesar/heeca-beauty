import { addDaysToKey, type DateKey } from "@/lib/dates";

// Campanhas. Puro: quem entra em cada lista e como a mensagem é montada.

export type CampaignKind = "BIRTHDAY" | "REACTIVATION";
export const CAMPAIGN_LABEL: Record<CampaignKind, string> = { BIRTHDAY: "Aniversariantes", REACTIVATION: "Reativação" };

export const DEFAULT_BIRTHDAY = "Oi, {nome}! 🎂 Hoje é um dia especial e a equipe do {estabelecimento} quer te desejar um feliz aniversário! Que tal comemorar com a gente? É só responder aqui para agendar seu horário.";
export const DEFAULT_REACTIVATION = "Oi, {nome}! Sentimos sua falta no {estabelecimento}. 💛 Faz um tempinho que não nos vemos. Que tal marcar seu próximo horário? É só responder aqui.";

export const MIN_REACTIVATION_DAYS = 15;
export const MAX_REACTIVATION_DAYS = 365;

/** `{nome}` vira o primeiro nome da cliente e `{estabelecimento}` o nome do negócio. Marcadores desconhecidos ficam como estão. */
export function montarMensagem(modelo: string, vars: { nome: string; estabelecimento: string }): string {
  const primeiro = vars.nome.trim().split(/\s+/)[0] || "";
  return modelo.replaceAll("{nome}", primeiro).replaceAll("{estabelecimento}", vars.estabelecimento);
}

const pad = (n: number) => String(n).padStart(2, "0");
const bissexto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Dia do aniversário no ano `ano` (29/02 cai em 28/02 nos anos não bissextos). */
export function aniversarioNoAno(birth: Date, ano: number): DateKey {
  const m = birth.getUTCMonth() + 1;
  const d = birth.getUTCDate();
  return `${ano}-${pad(m)}-${pad(m === 2 && d === 29 && !bissexto(ano) ? 28 : d)}`;
}

/** Aniversário que cai de hoje até `dias` dias adiante (inclusive), considerando a virada do ano. Devolve a data e quantos dias faltam. */
export function proximoAniversario(birth: Date, hoje: DateKey, dias: number): { dia: DateKey; emDias: number } | null {
  const ano = Number(hoje.slice(0, 4));
  for (const y of [ano, ano + 1]) {
    const dia = aniversarioNoAno(birth, y);
    if (dia < hoje) continue;
    const emDias = Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
    return emDias <= dias ? { dia, emDias } : null;
  }
  return null;
}

/**
 * Cliente inativa: tem pelo menos um atendimento concluído, o último foi há `dias` dias ou mais e não há agendamento
 * futuro. Quem nunca foi atendida não entra (não "voltou").
 */
export function estaInativa(input: { ultimaVisita: Date | null; temAgendamentoFuturo: boolean; agora: Date; dias: number }): { inativa: boolean; diasSemVir: number | null } {
  if (!input.ultimaVisita) return { inativa: false, diasSemVir: null };
  const diasSemVir = Math.floor((input.agora.getTime() - input.ultimaVisita.getTime()) / 86_400_000);
  return { inativa: !input.temAgendamentoFuturo && diasSemVir >= input.dias, diasSemVir };
}

/** Uma vez por período: aniversário por ano, reativação por mês. */
export const periodoDaCampanha = (kind: CampaignKind, hoje: DateKey) => (kind === "BIRTHDAY" ? hoje.slice(0, 4) : hoje.slice(0, 7));

export const validarDiasReativacao = (v: number) => Number.isInteger(v) && v >= MIN_REACTIVATION_DAYS && v <= MAX_REACTIVATION_DAYS;

export { addDaysToKey };

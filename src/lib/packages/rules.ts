/**
 * Pacotes de sessões — regras puras (sem banco; testes em tests/packages.test.ts).
 *
 * O pacote vendido (ClientPackage) não pré-cria as N sessões: cada PackageSession nasce quando um item
 * de visita é vinculado a ele. Por isso "restantes" é sempre calculado, e a regra do que CONSOME uma
 * sessão vive num só lugar (`consomeSessao`).
 */
import type { AppointmentStatus, ClientPackageStatus, PackageSessionStatus } from "@/generated/prisma/enums";

const DIA = 86_400_000;

export type EscopoPacote = {
  clientId: string;
  /** Serviço específico ("5 massagens relaxantes")… */
  serviceId: string | null;
  /** …ou qualquer serviço desta categoria ("5 massagens"); ambos nulos = qualquer serviço. */
  categoryId: string | null;
};
export type EscopoItem = { clientId: string; serviceId: string; categoryId: string | null };

/**
 * Este item de visita pode ser descontado deste pacote? O cliente tem de ser o mesmo, sem exceção.
 * Estrito por padrão: uma massagem do pacote nunca vira um Day Spa sem aviso.
 */
export function itemCabeNoPacote(pacote: EscopoPacote, item: EscopoItem): { ok: true } | { ok: false; motivo: string } {
  if (pacote.clientId !== item.clientId) return { ok: false, motivo: "O agendamento é de outro cliente." };
  if (pacote.serviceId) return pacote.serviceId === item.serviceId ? { ok: true } : { ok: false, motivo: "O pacote cobre só o serviço contratado." };
  if (pacote.categoryId) return pacote.categoryId === item.categoryId ? { ok: true } : { ok: false, motivo: "Este serviço não é da categoria do pacote." };
  return { ok: true };
}

/** Status da sessão espelhado do status da visita a que o item pertence. */
export function statusDaSessao(status: AppointmentStatus): PackageSessionStatus {
  switch (status) {
    case "COMPLETED": return "DONE";
    case "NO_SHOW": return "NO_SHOW";
    case "CANCELLED_BY_CLIENT":
    case "CANCELLED_BY_PROFESSIONAL": return "CANCELLED";
    default: return "SCHEDULED";
  }
}

/** Política do estabelecimento para falta em sessão de pacote (Tenant.faltaConsomeSessao). */
export type RegraFalta = "CONSOME" | "LIBERA";

/** DONE consome sempre; CANCELLED nunca; NO_SHOW conforme a política; SCHEDULED só reserva. */
export function consomeSessao(sessao: { status: PackageSessionStatus }, regra: RegraFalta): boolean {
  if (sessao.status === "DONE") return true;
  if (sessao.status === "NO_SHOW") return regra === "CONSOME";
  return false;
}

export type PacoteLike = { status: ClientPackageStatus; sessionsTotal: number; expiresAt: Date | null };

export type Progresso = {
  total: number;
  /** Sessões descontadas do saldo. */
  usadas: number;
  /** Sessões com horário ativo, ainda não descontadas. */
  agendadas: number;
  /** total − usadas. */
  restantes: number;
  /** restantes − agendadas: quantas ainda dá para marcar. */
  disponiveis: number;
  vencido: boolean;
  /** Ativo, dentro da validade e com saldo livre para marcar. */
  podeAgendar: boolean;
};

/** "5 contratadas → 1 utilizada → 4 restantes". expiresAt é data (meia-noite UTC): o pacote vale até o fim daquele dia. */
export function progresso(pacote: PacoteLike, sessoes: { status: PackageSessionStatus }[], regra: RegraFalta, agora = new Date()): Progresso {
  const usadas = sessoes.filter((s) => consomeSessao(s, regra)).length;
  const agendadas = sessoes.filter((s) => s.status === "SCHEDULED").length;
  const restantes = Math.max(0, pacote.sessionsTotal - usadas);
  const disponiveis = Math.max(0, restantes - agendadas);
  const vencido = pacote.expiresAt !== null && pacote.expiresAt.getTime() + DIA <= agora.getTime();
  return { total: pacote.sessionsTotal, usadas, agendadas, restantes, disponiveis, vencido, podeAgendar: pacote.status === "ACTIVE" && !vencido && disponiveis > 0 };
}

/** Status que o pacote DEVERIA ter dado o progresso — o cron e as ações comparam com o gravado. */
export function statusDoPacote(pacote: PacoteLike, p: Progresso): ClientPackageStatus {
  if (pacote.status === "CANCELLED") return "CANCELLED";
  if (p.restantes === 0) return "COMPLETED";
  if (p.vencido) return "EXPIRED";
  return "ACTIVE";
}

/** Validade de um pacote comprado em `inicio`: + validityDays; null = sem validade. */
export function vencimento(inicio: Date, validityDays: number | null | undefined): Date | null {
  if (!validityDays || validityDays <= 0) return null;
  return new Date(inicio.getTime() + validityDays * DIA);
}

/**
 * Qual pacote do cliente cobre este item? Preferência: pacote de serviço > de categoria > livre;
 * entre iguais, o que vence primeiro. Só pacotes com saldo livre (`disponiveis` já decrementado pelo chamador).
 */
export function escolherPacote<P extends EscopoPacote & { id: string; expiresAt: Date | null }>(pacotes: P[], disponiveis: Map<string, number>, item: EscopoItem): P | null {
  const rank = (p: P) => (p.serviceId ? 0 : p.categoryId ? 1 : 2);
  return [...pacotes]
    .sort((a, b) => rank(a) - rank(b) || (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity))
    .find((p) => (disponiveis.get(p.id) ?? 0) > 0 && itemCabeNoPacote(p, item).ok) ?? null;
}

export const STATUS_PACOTE: Record<ClientPackageStatus, string> = { ACTIVE: "Em andamento", COMPLETED: "Concluído", EXPIRED: "Vencido", CANCELLED: "Cancelado" };
export const STATUS_SESSAO: Record<PackageSessionStatus, string> = { SCHEDULED: "Agendada", DONE: "Realizada", NO_SHOW: "Falta", CANCELLED: "Cancelada" };

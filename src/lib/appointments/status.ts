import type { AppointmentStatus, AppointmentActor } from "@/generated/prisma/enums";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pendente",
  AWAITING_PAYMENT: "Aguardando pagamento",
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  RESCHEDULE_REQUESTED: "Reagendamento solicitado",
  CANCELLED_BY_CLIENT: "Cancelado pela cliente",
  CANCELLED_BY_PROFESSIONAL: "Cancelado pelo profissional",
  COMPLETED: "Concluído",
  NO_SHOW: "Não compareceu",
};

/** Classes Tailwind para o "badge" de status. */
export const STATUS_STYLES: Record<AppointmentStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  AWAITING_PAYMENT: "bg-brand-50 text-brand-700",
  AWAITING_CONFIRMATION: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  RESCHEDULE_REQUESTED: "bg-orange-50 text-orange-700",
  CANCELLED_BY_CLIENT: "bg-zinc-100 text-zinc-600",
  CANCELLED_BY_PROFESSIONAL: "bg-zinc-100 text-zinc-600",
  COMPLETED: "bg-sky-50 text-sky-700",
  NO_SHOW: "bg-rose-50 text-rose-700",
};

export const CANCELLED_STATUSES: AppointmentStatus[] = ["CANCELLED_BY_CLIENT", "CANCELLED_BY_PROFESSIONAL"];
// RESCHEDULE_REQUESTED continua ocupando o horário original até a profissional remarcar ou cancelar.
export const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "AWAITING_PAYMENT", "AWAITING_CONFIRMATION", "CONFIRMED", "RESCHEDULE_REQUESTED"];
export const FINAL_STATUSES: AppointmentStatus[] = [...CANCELLED_STATUSES, "COMPLETED", "NO_SHOW"];

/**
 * Transições permitidas por ator. Qualquer coisa fora desta tabela é rejeitada.
 *  - CLIENT: só via link/botão de WhatsApp.
 *  - PROFESSIONAL: ações do painel.
 *  - SYSTEM: cron (expiração de pendentes).
 */
const TRANSITIONS: Record<AppointmentActor, Partial<Record<AppointmentStatus, AppointmentStatus[]>>> = {
  CLIENT: {
    PENDING: ["CONFIRMED", "CANCELLED_BY_CLIENT"],
    AWAITING_PAYMENT: ["CANCELLED_BY_CLIENT"], // confirmar só pagando
    AWAITING_CONFIRMATION: ["CONFIRMED", "CANCELLED_BY_CLIENT", "RESCHEDULE_REQUESTED"],
    CONFIRMED: ["CANCELLED_BY_CLIENT", "RESCHEDULE_REQUESTED"],
    RESCHEDULE_REQUESTED: ["CANCELLED_BY_CLIENT"],
  },
  PROFESSIONAL: {
    PENDING: ["CONFIRMED", "CANCELLED_BY_PROFESSIONAL", "COMPLETED", "NO_SHOW"],
    AWAITING_PAYMENT: ["CONFIRMED", "CANCELLED_BY_PROFESSIONAL"], // ex.: cliente pagou em dinheiro
    AWAITING_CONFIRMATION: ["CONFIRMED", "CANCELLED_BY_PROFESSIONAL", "COMPLETED", "NO_SHOW"],
    CONFIRMED: ["CANCELLED_BY_PROFESSIONAL", "COMPLETED", "NO_SHOW"],
    // Reagendar (reschedule()) leva de volta a CONFIRMED; aqui só as saídas manuais.
    RESCHEDULE_REQUESTED: ["CONFIRMED", "CANCELLED_BY_PROFESSIONAL"],
    // Correções de erro operacional: "marquei como faltou mas ele veio"
    COMPLETED: ["NO_SHOW"],
    NO_SHOW: ["COMPLETED"],
  },
  SYSTEM: {
    PENDING: ["AWAITING_CONFIRMATION", "CANCELLED_BY_PROFESSIONAL"],
    AWAITING_PAYMENT: ["CONFIRMED", "CANCELLED_BY_PROFESSIONAL"], // pago via webhook / prazo vencido
    AWAITING_CONFIRMATION: ["CANCELLED_BY_PROFESSIONAL"],
    RESCHEDULE_REQUESTED: ["CONFIRMED", "CANCELLED_BY_PROFESSIONAL"], // remarcado pela profissional / horário passou
  },
};

export function canTransition(actor: AppointmentActor, from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[actor][from]?.includes(to) ?? false;
}

export function isActive(status: AppointmentStatus) {
  return ACTIVE_STATUSES.includes(status);
}

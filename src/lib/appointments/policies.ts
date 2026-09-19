import type { Tenant } from "@/generated/prisma/client";
import type { AppointmentActor, AppointmentStatus } from "@/generated/prisma/enums";
import { FINAL_STATUSES } from "./status";

/**
 * Políticas de negócio configuráveis do agendamento.
 * Ficam isoladas aqui para que a regra seja fácil de ler, testar e ajustar
 * sem mexer no fluxo de criação/transição (service.ts).
 */

type TenantPolicy = Pick<Tenant, "pendingExpiryMinutes" | "cancelDeadlineHours" | "requireWhatsappConfirmation">;

/** Margem mínima antes do atendimento para um pendente ser liberado. */
const MIN_RELEASE_MARGIN_MS = 30 * 60_000;

/**
 * Quando um agendamento ainda não confirmado deve ser liberado automaticamente.
 *
 * Regra:
 *  - sem confirmação via WhatsApp ou sem prazo configurado → nunca expira (null);
 *  - normalmente: `now + pendingExpiryMinutes`;
 *  - se isso cair muito perto (ou depois) do horário do atendimento, antecipa a
 *    expiração para 30 min antes do início — assim um pendente de última hora ainda
 *    libera a vaga a tempo de outro cliente aproveitar;
 *  - se nem 30 min antes é possível (agendou em cima da hora), não expira: o
 *    profissional decide manualmente.
 */
export function computeExpiresAt(tenant: TenantPolicy, startsAt: Date, now: Date = new Date()): Date | null {
  if (!tenant.requireWhatsappConfirmation || tenant.pendingExpiryMinutes == null || tenant.pendingExpiryMinutes <= 0) return null;

  const byConfig = new Date(now.getTime() + tenant.pendingExpiryMinutes * 60_000);
  const latestUseful = new Date(startsAt.getTime() - MIN_RELEASE_MARGIN_MS);

  if (byConfig <= latestUseful) return byConfig;
  if (latestUseful > now) return latestUseful;
  return null;
}

/**
 * O cliente pode cancelar pelo link/WhatsApp?
 *
 * Regra:
 *  - status finais (concluído, faltou, cancelado) → não;
 *  - atendimento já iniciado → não;
 *  - ainda não confirmado (PENDING / AWAITING_CONFIRMATION) → sempre pode: a vaga
 *    ainda não foi "prometida" ao profissional, cancelar só libera agenda;
 *  - confirmado → só até `cancelDeadlineHours` antes (0 = a qualquer momento).
 */
export function canClientCancel(
  tenant: TenantPolicy,
  appointment: { status: AppointmentStatus; startsAt: Date },
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (FINAL_STATUSES.includes(appointment.status)) {
    return { ok: false, reason: "Este agendamento já foi finalizado ou cancelado." };
  }
  if (appointment.startsAt <= now) {
    return { ok: false, reason: "O horário deste atendimento já passou." };
  }
  if (appointment.status !== "CONFIRMED") return { ok: true };

  const deadline = new Date(appointment.startsAt.getTime() - tenant.cancelDeadlineHours * 3_600_000);
  if (now <= deadline) return { ok: true };

  const h = tenant.cancelDeadlineHours;
  return {
    ok: false,
    reason: `Cancelamentos só são aceitos até ${h} hora${h === 1 ? "" : "s"} antes do horário. Fale diretamente com o estabelecimento.`,
  };
}

/**
 * O sinal pago deve ser estornado quando o agendamento é cancelado?
 *  - profissional cancelou → sim (o cliente não tem culpa);
 *  - cliente cancelou → sim, pois `canClientCancel` já garante que foi dentro do prazo;
 *  - sistema (prazo de pagamento vencido) → nunca há sinal pago, então indiferente.
 * "Não compareceu" não passa por aqui: o sinal fica com o profissional.
 */
export function shouldRefundDeposit(actor: AppointmentActor): boolean {
  return actor === "PROFESSIONAL" || actor === "CLIENT";
}

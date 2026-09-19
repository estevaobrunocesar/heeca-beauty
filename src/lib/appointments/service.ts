import "server-only";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import type { Tenant } from "@/generated/prisma/client";
import type { AppointmentActor, AppointmentSource, AppointmentStatus } from "@/generated/prisma/enums";
import { normalizePhone } from "@/lib/phone";
import { getAvailableSlots, getAvailableSlotsAny } from "@/lib/scheduling/service";
import { sendAppointmentMessage } from "@/lib/whatsapp/service";
import { canTransition, ACTIVE_STATUSES } from "./status";
import { canClientCancel, computeExpiresAt, shouldRefundDeposit } from "./policies";
import { computeDepositCents } from "@/lib/payments/deposit";
import { createDepositCharge, expireDeposit, refundDeposit } from "@/lib/payments/service";
import { computeBookingTotals, normalizeAddOnIds } from "@/lib/services/addons";

export class AppointmentError extends Error {
  constructor(message: string, readonly code: string = "APPOINTMENT_ERROR") {
    super(message);
  }
}

type CreateInput = {
  tenant: Tenant;
  /** Omitido = "qualquer profissional": o sistema escolhe quem estiver livre. */
  professionalId?: string | null;
  serviceId: string;
  /** Adicionais (Service.isAddOn) escolhidos junto com o procedimento principal. */
  addOnIds?: string[] | null;
  dateKey: string;
  minutes: number;
  client: { name: string; phone: string; email?: string | null };
  notes?: string | null;
  source: AppointmentSource;
  actor: AppointmentActor;
};

/**
 * Cria um agendamento validando disponibilidade, duplicidade e conflitos.
 * Fluxo (seção 5): registra → aciona WhatsApp → aguarda confirmação do cliente.
 */
export async function createAppointment(input: CreateInput) {
  const { tenant, serviceId, dateKey, minutes, source, actor } = input;

  const service = await db.service.findFirst({
    where: { id: serviceId, tenantId: tenant.id, active: true, deletedAt: null, isAddOn: false },
    include: { professionals: { where: { professional: { active: true } }, include: { professional: { select: { id: true, sortOrder: true } } } } },
  });
  if (!service) throw new AppointmentError("Serviço indisponível.", "SERVICE_NOT_FOUND");

  // Adicionais: só os ativos do mesmo tenant; qualquer id inválido invalida o pedido.
  const addOnIds = normalizeAddOnIds(input.addOnIds);
  const addOns = addOnIds.length
    ? await db.service.findMany({ where: { id: { in: addOnIds }, tenantId: tenant.id, active: true, deletedAt: null, isAddOn: true } })
    : [];
  if (addOns.length !== addOnIds.length) throw new AppointmentError("Um dos adicionais escolhidos não está mais disponível.", "ADDON_NOT_FOUND");
  const totals = computeBookingTotals(service, addOns);

  // Quem pode executar este serviço (ativos, na ordem de exibição)
  const eligible = service.professionals.map((ps) => ps.professional).sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.id);
  if (eligible.length === 0) throw new AppointmentError("Nenhum profissional disponível para este serviço.", "NO_PROFESSIONAL");

  const phone = normalizePhone(input.client.phone);
  if (!phone) throw new AppointmentError("Número de WhatsApp inválido.", "INVALID_PHONE");

  // A mesma função que lista horários na página pública valida a escolha aqui.
  let professionalId: string;
  let slot: { minutes: number; startsAt: Date; endsAt: Date } | undefined;
  if (input.professionalId) {
    if (!eligible.includes(input.professionalId)) throw new AppointmentError("Este profissional não realiza o serviço escolhido.", "PROFESSIONAL_MISMATCH");
    professionalId = input.professionalId;
    slot = (await getAvailableSlots({ tenant, professionalId, dateKey, durationMinutes: totals.durationMinutes })).find((s) => s.minutes === minutes);
  } else {
    const any = (await getAvailableSlotsAny({ tenant, professionalIds: eligible, dateKey, durationMinutes: totals.durationMinutes })).find((s) => s.minutes === minutes);
    professionalId = any?.professionalId ?? "";
    slot = any;
  }
  if (!slot || !professionalId) throw new AppointmentError("Este horário não está mais disponível. Escolha outro.", "SLOT_UNAVAILABLE");

  // Sinal via Pix: só para agendamentos da página pública. Pagou = confirmou.
  const depositCents = source === "PUBLIC" ? computeDepositCents(tenant, totals.priceCents) : 0;
  // Confirmação automática quando o profissional dispensa WhatsApp ou agenda manualmente.
  const autoConfirm = depositCents === 0 && (source === "DASHBOARD" || !tenant.requireWhatsappConfirmation);
  const initialStatus: AppointmentStatus = depositCents > 0 ? "AWAITING_PAYMENT" : autoConfirm ? "CONFIRMED" : "PENDING";
  const paymentDeadline = new Date(Date.now() + tenant.depositTimeoutMinutes * 60_000);

  const appointment = await db.$transaction(
    async (tx) => {
      const client = await tx.client.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone } },
        create: { tenantId: tenant.id, name: input.client.name.trim(), phone, email: input.client.email?.trim() || null },
        update: {
          name: input.client.name.trim(),
          ...(input.client.email?.trim() ? { email: input.client.email.trim() } : {}),
        },
      });

      // Duplicado: mesmo cliente, mesmo horário, ainda ativo.
      const duplicate = await tx.appointment.findFirst({
        where: { clientId: client.id, startsAt: slot.startsAt, status: { in: ACTIVE_STATUSES } },
        select: { id: true },
      });
      if (duplicate) throw new AppointmentError("Você já possui um agendamento neste horário.", "DUPLICATE");

      const created = await tx.appointment.create({
        data: {
          tenantId: tenant.id,
          professionalId,
          serviceId: service.id,
          clientId: client.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: initialStatus,
          source,
          serviceName: service.name,
          durationMinutes: totals.durationMinutes,
          priceCents: totals.priceCents,
          addOns: { create: addOns.map((a) => ({ serviceId: a.id, name: a.name, durationMinutes: a.durationMinutes, priceCents: a.priceCents })) },
          notes: input.notes?.trim() || null,
          confirmationToken: nanoid(24),
          confirmedAt: autoConfirm ? new Date() : null,
          // Sinal: libera o horário se não pagar no prazo (nunca depois do início do atendimento).
          expiresAt: depositCents > 0
            ? new Date(Math.min(paymentDeadline.getTime(), slot.startsAt.getTime()))
            : autoConfirm ? null : computeExpiresAt(tenant, slot.startsAt),
          events: { create: { tenantId: tenant.id, actor, type: "CREATED", toStatus: initialStatus } },
        },
      });

      // Proteção contra corrida: dois clientes reservando o mesmo slot ao mesmo tempo.
      const concurrent = await tx.appointment.count({
        where: {
          professionalId,
          status: { in: ACTIVE_STATUSES },
          startsAt: { lt: slot.endsAt },
          endsAt: { gt: slot.startsAt },
        },
      });
      if (concurrent > tenant.maxConcurrentAppointments) {
        throw new AppointmentError("Este horário acabou de ser reservado por outra pessoa.", "SLOT_UNAVAILABLE");
      }
      return created;
    },
    { isolationLevel: "Serializable" },
  );

  // Efeitos colaterais fora da transação: o agendamento já está garantido.
  if (depositCents > 0) {
    try {
      await createDepositCharge(appointment.id, depositCents, appointment.expiresAt ?? paymentDeadline);
    } catch (err) {
      // Sem cobrança não há como pagar: desfaz a reserva para não prender o horário.
      console.error("[pix] falha ao gerar cobrança; cancelando reserva", appointment.id, err);
      await db.appointment.delete({ where: { id: appointment.id } });
      throw new AppointmentError("Não foi possível gerar o Pix agora. Tente novamente em instantes.", "PAYMENT_UNAVAILABLE");
    }
    await sendAppointmentMessage(appointment.id, "PAYMENT_REQUEST");
  } else if (autoConfirm) {
    await sendAppointmentMessage(appointment.id, "CONFIRMED");
  } else {
    const sent = await sendAppointmentMessage(appointment.id, "REQUEST_CONFIRMATION");
    if (sent?.ok) await transition({ appointmentId: appointment.id, actor: "SYSTEM", to: "AWAITING_CONFIRMATION", notify: false });
  }
  return appointment;
}

type TransitionInput = {
  appointmentId: string;
  tenantId?: string; // quando vem do painel, garante isolamento do tenant
  actor: AppointmentActor;
  to: AppointmentStatus;
  reason?: string | null;
  notify?: boolean;
};

/** Muda o status respeitando a máquina de estados e registrando o evento. */
export async function transition(input: TransitionInput) {
  const { appointmentId, actor, to, reason } = input;
  const notify = input.notify ?? true;

  const appt = await db.appointment.findFirst({
    where: { id: appointmentId, ...(input.tenantId ? { tenantId: input.tenantId } : {}) },
  });
  if (!appt) throw new AppointmentError("Agendamento não encontrado.", "NOT_FOUND");
  if (appt.status === to) return appt;
  if (!canTransition(actor, appt.status, to)) {
    throw new AppointmentError(`Não é possível mudar de "${appt.status}" para "${to}".`, "INVALID_TRANSITION");
  }

  const isCancel = to === "CANCELLED_BY_CLIENT" || to === "CANCELLED_BY_PROFESSIONAL";
  const updated = await db.appointment.update({
    where: { id: appt.id },
    data: {
      status: to,
      ...(to === "CONFIRMED" ? { confirmedAt: new Date(), expiresAt: null } : {}),
      ...(isCancel ? { cancelledAt: new Date(), cancelReason: reason ?? null, expiresAt: null } : {}),
      events: { create: { tenantId: appt.tenantId, actor, type: "STATUS_CHANGED", fromStatus: appt.status, toStatus: to, data: reason ? { reason } : undefined } },
    },
  });

  if (isCancel) {
    // Sinal: cobrança pendente é encerrada; sinal pago é estornado conforme a política.
    await expireDeposit(appt.id, "CANCELLED");
    if (shouldRefundDeposit(actor)) await refundDeposit(appt.id);
  }

  if (notify) {
    if (to === "CONFIRMED") await sendAppointmentMessage(appt.id, "CONFIRMED");
    else if (isCancel) await sendAppointmentMessage(appt.id, "CANCELLED");
  }
  return updated;
}

export async function reschedule(input: {
  appointmentId: string;
  tenant: Tenant;
  dateKey: string;
  minutes: number;
  actor: AppointmentActor;
}) {
  const { tenant, dateKey, minutes, actor } = input;
  const appt = await db.appointment.findFirst({ where: { id: input.appointmentId, tenantId: tenant.id } });
  if (!appt) throw new AppointmentError("Agendamento não encontrado.", "NOT_FOUND");
  if (!ACTIVE_STATUSES.includes(appt.status)) throw new AppointmentError("Só é possível reagendar agendamentos ativos.");

  const slots = await getAvailableSlots({
    tenant, professionalId: appt.professionalId, dateKey, durationMinutes: appt.durationMinutes, excludeAppointmentId: appt.id,
  });
  const slot = slots.find((s) => s.minutes === minutes);
  if (!slot) throw new AppointmentError("Horário indisponível para reagendamento.", "SLOT_UNAVAILABLE");

  // Cliente havia pedido outro horário: remarcar resolve o pedido e o agendamento volta a CONFIRMADO.
  const resolvingRequest = appt.status === "RESCHEDULE_REQUESTED";
  const updated = await db.appointment.update({
    where: { id: appt.id },
    data: {
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      reminderSentAt: null, // novo horário, novo lembrete
      ...(resolvingRequest ? { status: "CONFIRMED", confirmedAt: new Date() } : {}),
      events: {
        create: {
          tenantId: tenant.id, actor, type: "RESCHEDULED",
          fromStatus: resolvingRequest ? appt.status : undefined, toStatus: resolvingRequest ? "CONFIRMED" : undefined,
          data: { from: appt.startsAt.toISOString(), to: slot.startsAt.toISOString() },
        },
      },
    },
  });
  await sendAppointmentMessage(appt.id, "RESCHEDULED");
  return updated;
}

// ───────────── Ações do cliente via token (link ou botão do WhatsApp) ─────────────

export async function findByToken(token: string) {
  return db.appointment.findUnique({
    where: { confirmationToken: token },
    include: { tenant: true, professional: true, client: true },
  });
}

export async function confirmByToken(token: string) {
  const appt = await findByToken(token);
  if (!appt) throw new AppointmentError("Link inválido.", "NOT_FOUND");
  if (appt.status === "CONFIRMED") return appt;
  if (appt.startsAt < new Date()) throw new AppointmentError("Este horário já passou.");
  return transition({ appointmentId: appt.id, actor: "CLIENT", to: "CONFIRMED" });
}

/** Cliente pediu outro horário (link ou WhatsApp). O horário original fica reservado até a profissional agir. */
export async function requestRescheduleByToken(token: string) {
  const appt = await findByToken(token);
  if (!appt) throw new AppointmentError("Link inválido.", "NOT_FOUND");
  if (appt.status === "RESCHEDULE_REQUESTED") return appt;
  if (appt.startsAt < new Date()) throw new AppointmentError("Este horário já passou.");
  return transition({ appointmentId: appt.id, actor: "CLIENT", to: "RESCHEDULE_REQUESTED", notify: false });
}

export async function cancelByToken(token: string) {
  const appt = await findByToken(token);
  if (!appt) throw new AppointmentError("Link inválido.", "NOT_FOUND");
  const policy = canClientCancel(appt.tenant, appt);
  if (!policy.ok) throw new AppointmentError(policy.reason, "CANCEL_NOT_ALLOWED");
  return transition({ appointmentId: appt.id, actor: "CLIENT", to: "CANCELLED_BY_CLIENT" });
}

// ───────────── Rotinas automáticas (cron) ─────────────

/** Libera horários de agendamentos não confirmados (ou não pagos) cujo prazo venceu. */
export async function expirePendingAppointments(now = new Date()) {
  const due = await db.appointment.findMany({
    where: { status: { in: ["PENDING", "AWAITING_PAYMENT", "AWAITING_CONFIRMATION"] }, expiresAt: { not: null, lte: now } },
    select: { id: true },
  });
  let count = 0;
  for (const { id } of due) {
    try {
      await expireDeposit(id, "EXPIRED"); // antes do transition, que marcaria como CANCELLED
      await transition({ appointmentId: id, actor: "SYSTEM", to: "CANCELLED_BY_PROFESSIONAL", reason: "Não confirmado/pago no prazo" });
      count++;
    } catch (err) {
      console.error("[cron:expire] falha em", id, err);
    }
  }
  return count;
}

/** Envia lembretes para agendamentos confirmados dentro da janela configurada por tenant. */
export async function sendDueReminders(now = new Date()) {
  const tenants = await db.tenant.findMany({ select: { id: true, reminderHoursBefore: true } });
  let count = 0;
  for (const t of tenants) {
    const until = new Date(now.getTime() + t.reminderHoursBefore * 3_600_000);
    const due = await db.appointment.findMany({
      where: { tenantId: t.id, status: "CONFIRMED", reminderSentAt: null, startsAt: { gt: now, lte: until } },
      select: { id: true },
    });
    for (const { id } of due) {
      const sent = await sendAppointmentMessage(id, "REMINDER");
      if (sent?.ok) {
        await db.appointment.update({ where: { id }, data: { reminderSentAt: now } });
        count++;
      }
    }
  }
  return count;
}

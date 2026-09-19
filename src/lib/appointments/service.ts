import "server-only";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import type { Tenant } from "@/generated/prisma/client";
import type { AppointmentActor, AppointmentSource, AppointmentStatus } from "@/generated/prisma/enums";
import { normalizePhone } from "@/lib/phone";
import { getVisitSlots } from "@/lib/scheduling/service";
import type { VisitItem } from "@/lib/scheduling/availability";
import { zonedDateTimeToUtc } from "@/lib/dates";
import { sendAppointmentMessage } from "@/lib/whatsapp/service";
import { canTransition, ACTIVE_STATUSES } from "./status";
import { canClientCancel, computeExpiresAt, shouldRefundDeposit } from "./policies";
import { computeDepositCents } from "@/lib/payments/deposit";
import { createDepositCharge, expireDeposit, refundDeposit } from "@/lib/payments/service";
import { computeBookingTotals, describeBooking, normalizeAddOnIds } from "@/lib/services/addons";
import { describeVisit, visitTotals } from "./summary";

export class AppointmentError extends Error {
  constructor(message: string, readonly code: string = "APPOINTMENT_ERROR") {
    super(message);
  }
}

/** Um serviço pedido pela cliente, ainda sem horário. */
export type CreateItemInput = {
  serviceId: string;
  /** Omitido = "qualquer profissional": o sistema escolhe quem estiver livre (SPEC §10). */
  professionalId?: string | null;
  /** Adicionais (Service.isAddOn) escolhidos junto com este serviço. */
  addOnIds?: string[] | null;
};

type CreateInput = {
  tenant: Tenant;
  /** Serviços da visita, na ordem em que a cliente vai fazê-los (SPEC §11). */
  items: CreateItemInput[];
  dateKey: string;
  minutes: number; // início da visita (minutos do dia no fuso do tenant)
  client: { name: string; phone: string; email?: string | null };
  notes?: string | null;
  source: AppointmentSource;
  actor: AppointmentActor;
};

export const MAX_ITEMS_PER_VISIT = 6;

/**
 * Resolve os serviços/adicionais/profissionais pedidos e monta os `VisitItem` do motor.
 * Compartilhado por `createAppointment` e pela rota pública de horários, para que a lista
 * de horários e a validação do pedido usem exatamente as mesmas regras.
 */
export async function resolveVisitItems(tenantId: string, inputs: CreateItemInput[]) {
  if (inputs.length === 0) throw new AppointmentError("Escolha ao menos um serviço.", "NO_ITEMS");
  if (inputs.length > MAX_ITEMS_PER_VISIT) throw new AppointmentError(`No máximo ${MAX_ITEMS_PER_VISIT} serviços por agendamento.`, "TOO_MANY_ITEMS");

  const serviceIds = [...new Set(inputs.map((i) => i.serviceId))];
  const addOnIds = [...new Set(inputs.flatMap((i) => normalizeAddOnIds(i.addOnIds)))];
  const [services, addOns] = await Promise.all([
    db.service.findMany({
      where: { id: { in: serviceIds }, tenantId, active: true, deletedAt: null, isAddOn: false },
      include: { professionals: { where: { professional: { active: true } }, include: { professional: { select: { id: true, sortOrder: true } } } } },
    }),
    addOnIds.length
      ? db.service.findMany({ where: { id: { in: addOnIds }, tenantId, active: true, deletedAt: null, isAddOn: true } })
      : Promise.resolve([]),
  ]);
  if (services.length !== serviceIds.length) throw new AppointmentError("Um dos serviços escolhidos não está mais disponível.", "SERVICE_NOT_FOUND");
  if (addOns.length !== addOnIds.length) throw new AppointmentError("Um dos adicionais escolhidos não está mais disponível.", "ADDON_NOT_FOUND");
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const addOnById = new Map(addOns.map((a) => [a.id, a]));

  return inputs.map((input, index) => {
    const service = serviceById.get(input.serviceId)!;
    const itemAddOns = normalizeAddOnIds(input.addOnIds).map((id) => addOnById.get(id)!);
    const totals = computeBookingTotals(service, itemAddOns);
    // Quem pode executar este serviço (ativos, na ordem de exibição)
    const eligible = service.professionals.map((ps) => ps.professional).sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.id);
    if (eligible.length === 0) throw new AppointmentError(`Nenhum profissional disponível para "${service.name}".`, "NO_PROFESSIONAL");
    let candidates = eligible;
    if (input.professionalId) {
      if (!eligible.includes(input.professionalId)) throw new AppointmentError(`Este profissional não realiza "${service.name}".`, "PROFESSIONAL_MISMATCH");
      candidates = [input.professionalId];
    }
    const visitItem: VisitItem = { key: String(index), durationMinutes: totals.durationMinutes, candidates };
    return {
      visitItem,
      service,
      addOns: itemAddOns,
      serviceName: describeBooking(service.name, itemAddOns.map((a) => a.name)),
      durationMinutes: totals.durationMinutes,
      priceCents: totals.priceCents,
    };
  });
}

/**
 * Cria uma visita validando disponibilidade de cada profissional, duplicidade e conflitos.
 * Fluxo: registra → aciona WhatsApp → aguarda confirmação da cliente.
 */
export async function createAppointment(input: CreateInput) {
  const { tenant, dateKey, minutes, source, actor } = input;

  const resolved = await resolveVisitItems(tenant.id, input.items);
  const totals = visitTotals(resolved);

  const phone = normalizePhone(input.client.phone);
  if (!phone) throw new AppointmentError("Número de WhatsApp inválido.", "INVALID_PHONE");

  // A mesma função que lista horários na página pública valida a escolha aqui.
  const slot = (await getVisitSlots({ tenant, items: resolved.map((r) => r.visitItem), dateKey })).find((s) => s.minutes === minutes);
  if (!slot) throw new AppointmentError("Este horário não está mais disponível. Escolha outro.", "SLOT_UNAVAILABLE");
  const placementOf = (index: number) => slot.placements.find((p) => p.key === String(index))!;
  const itemRows = resolved.map((r, index) => {
    const p = placementOf(index);
    return {
      tenantId: tenant.id,
      professionalId: p.professionalId,
      serviceId: r.service.id,
      startsAt: zonedDateTimeToUtc(dateKey, p.start, tenant.timezone),
      endsAt: zonedDateTimeToUtc(dateKey, p.end, tenant.timezone),
      sortOrder: index,
      serviceName: r.serviceName,
      durationMinutes: r.durationMinutes,
      priceCents: r.priceCents,
      addOns: { create: r.addOns.map((a) => ({ serviceId: a.id, name: a.name, durationMinutes: a.durationMinutes, priceCents: a.priceCents })) },
    };
  });

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
          clientId: client.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: initialStatus,
          source,
          serviceName: describeVisit(resolved),
          durationMinutes: totals.durationMinutes,
          priceCents: totals.priceCents,
          items: { create: itemRows },
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

      // Proteção contra corrida: duas clientes reservando o mesmo profissional ao mesmo tempo.
      // Checa item a item, porque cada um ocupa a agenda de um profissional diferente.
      for (const row of itemRows) {
        const concurrent = await tx.appointmentItem.count({
          where: {
            professionalId: row.professionalId,
            appointment: { status: { in: ACTIVE_STATUSES } },
            startsAt: { lt: row.endsAt },
            endsAt: { gt: row.startsAt },
          },
        });
        if (concurrent > tenant.maxConcurrentAppointments) {
          throw new AppointmentError("Este horário acabou de ser reservado por outra pessoa.", "SLOT_UNAVAILABLE");
        }
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
  const appt = await db.appointment.findFirst({
    where: { id: input.appointmentId, tenantId: tenant.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!appt) throw new AppointmentError("Agendamento não encontrado.", "NOT_FOUND");
  if (!ACTIVE_STATUSES.includes(appt.status)) throw new AppointmentError("Só é possível reagendar agendamentos ativos.");

  // Mesmos profissionais e durações; só a sequência é recolocada no novo início.
  const visitItems: VisitItem[] = appt.items.map((it) => ({ key: it.id, durationMinutes: it.durationMinutes, candidates: [it.professionalId] }));
  const slots = await getVisitSlots({ tenant, items: visitItems, dateKey, excludeAppointmentId: appt.id });
  const slot = slots.find((s) => s.minutes === minutes);
  if (!slot) throw new AppointmentError("Horário indisponível para reagendamento.", "SLOT_UNAVAILABLE");

  // Cliente havia pedido outro horário: remarcar resolve o pedido e o agendamento volta a CONFIRMADO.
  const resolvingRequest = appt.status === "RESCHEDULE_REQUESTED";
  const updated = await db.appointment.update({
    where: { id: appt.id },
    data: {
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      items: {
        update: slot.placements.map((p) => ({
          where: { id: p.key },
          data: { startsAt: zonedDateTimeToUtc(dateKey, p.start, tenant.timezone), endsAt: zonedDateTimeToUtc(dateKey, p.end, tenant.timezone) },
        })),
      },
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
    include: { tenant: true, client: true, items: { orderBy: { sortOrder: "asc" }, include: { professional: true } } },
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

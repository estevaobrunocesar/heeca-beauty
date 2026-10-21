import "server-only";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import type { Tenant } from "@/generated/prisma/client";
import type { AppointmentActor, AppointmentSource, AppointmentStatus, PaymentMethod } from "@/generated/prisma/enums";
import { parseClientPhone } from "@/lib/phone";
import { getVisitSlots, occupiedUtc, placeItemsInVisit } from "@/lib/scheduling/service";
import { visitIsParallel } from "@/lib/scheduling/availability";
import { espelharVisita, vincularVisita } from "@/lib/packages/service";
import type { ExistingItem, VisitItem } from "@/lib/scheduling/availability";
import { minutesToHHMM, toDateKey, toMinutesOfDay, zonedDateTimeToUtc } from "@/lib/dates";
import { sendAppointmentMessage } from "@/lib/whatsapp/service";
import { canTransition, ACTIVE_STATUSES } from "./status";
import { canClientCancel, computeExpiresAt, shouldRefundDeposit } from "./policies";
import { computeDepositCents } from "@/lib/payments/deposit";
import { createDepositCharge, expireDeposit, refundDeposit } from "@/lib/payments/service";
import { computeBookingTotals, describeBooking, normalizeAddOnIds } from "@/lib/services/addons";
import { describeVisit, visitTotals } from "./summary";
import { commissionCentsFor } from "@/lib/commissions";
import { baixarEstoqueDoAtendimento, estornarEstoqueDoAtendimento } from "@/lib/stock/db";
import { valeNaUnidade, unidadeDaVisita } from "@/lib/units/rules";
import { creditarCashbackDoAtendimento, estornarCashbackDoAtendimento } from "@/lib/loyalty/db";

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
  /** Omitido = o sistema escolhe a sala (primeira livre entre as permitidas). Só o painel força uma sala. */
  roomId?: string | null;
};

type CreateInput = {
  tenant: Tenant;
  /** Serviços da visita, na ordem em que a cliente vai fazê-los (SPEC §11). */
  items: CreateItemInput[];
  dateKey: string;
  minutes: number; // início da visita (minutos do dia no fuso do tenant)
  /** phone: obrigatório, a não ser que o estabelecimento dispense (Tenant.requirePhone = false). */
  client: { name: string; phone?: string | null; email?: string | null };
  notes?: string | null;
  source: AppointmentSource;
  actor: AppointmentActor;
  /** Visita simultânea (só pelo painel): os serviços começam juntos, cada profissional no seu. */
  parallel?: boolean;
  /** Unidade escolhida (estabelecimento com mais de uma). Restringe profissionais e salas e fica gravada na visita. */
  unitId?: string | null;
};

export const MAX_ITEMS_PER_VISIT = 6;

/**
 * Resolve os serviços/adicionais/profissionais pedidos e monta os `VisitItem` do motor.
 * Compartilhado por `createAppointment` e pela rota pública de horários, para que a lista
 * de horários e a validação do pedido usem exatamente as mesmas regras.
 */
export async function resolveVisitItems(tenantId: string, inputs: CreateItemInput[], chosenUnitId?: string | null) {
  if (inputs.length === 0) throw new AppointmentError("Escolha ao menos um serviço.", "NO_ITEMS");
  if (inputs.length > MAX_ITEMS_PER_VISIT) throw new AppointmentError(`No máximo ${MAX_ITEMS_PER_VISIT} serviços por agendamento.`, "TOO_MANY_ITEMS");

  const serviceIds = [...new Set(inputs.map((i) => i.serviceId))];
  const addOnIds = [...new Set(inputs.flatMap((i) => normalizeAddOnIds(i.addOnIds)))];
  const [services, addOns, allRooms] = await Promise.all([
    db.service.findMany({
      where: { id: { in: serviceIds }, tenantId, active: true, deletedAt: null, isAddOn: false },
      include: {
        professionals: { where: { professional: { active: true } }, include: { professional: { select: { id: true, sortOrder: true, unitId: true } } } },
        rooms: { where: { room: { active: true } }, include: { room: { select: { id: true, sortOrder: true, unitId: true } } } },
        resources: { where: { resource: { active: true } }, select: { resourceId: true, quantity: true } },
      },
    }),
    addOnIds.length
      ? db.service.findMany({ where: { id: { in: addOnIds }, tenantId, active: true, deletedAt: null, isAddOn: true } })
      : Promise.resolve([]),
    // Salas ativas na ordem cadastrada: candidatas de um serviço que exige sala sem restringir quais.
    db.room.findMany({ where: { tenantId, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, unitId: true } }),
  ]);
  if (services.length !== serviceIds.length) throw new AppointmentError("Um dos serviços escolhidos não está mais disponível.", "SERVICE_NOT_FOUND");
  if (addOns.length !== addOnIds.length) throw new AppointmentError("Um dos adicionais escolhidos não está mais disponível.", "ADDON_NOT_FOUND");
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const addOnById = new Map(addOns.map((a) => [a.id, a]));

  // Unidade da visita: a escolhida; sem escolha (painel), a do primeiro profissional pedido que tenha unidade. Assim a lista
  // de horários e a criação concordam e uma sala de outra unidade nunca é oferecida.
  const unitId = chosenUnitId ?? inputs.map((i) => (i.professionalId ? serviceById.get(i.serviceId)?.professionals.find((ps) => ps.professional.id === i.professionalId)?.professional.unitId ?? null : null)).find((u) => u != null) ?? null;

  return inputs.map((input, index) => {
    const service = serviceById.get(input.serviceId)!;
    const itemAddOns = normalizeAddOnIds(input.addOnIds).map((id) => addOnById.get(id)!);
    const totals = computeBookingTotals(service, itemAddOns);
    // Quem pode executar este serviço (ativos, na ordem de exibição)
    const eligible = service.professionals.map((ps) => ps.professional).filter((p) => valeNaUnidade(p.unitId, unitId)).sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.id);
    if (eligible.length === 0) throw new AppointmentError(unitId ? `Nenhum profissional desta unidade faz "${service.name}".` : `Nenhum profissional disponível para "${service.name}".`, "NO_PROFESSIONAL");
    let candidates = eligible;
    if (input.professionalId) {
      if (!eligible.includes(input.professionalId)) throw new AppointmentError(`Este profissional não realiza "${service.name}".`, "PROFESSIONAL_MISMATCH");
      candidates = [input.professionalId];
    }
    // Onde: salas específicas do serviço, ou qualquer sala ativa; null = serviço sem sala (opção salasAtivas desligada ou serviço sem exigência).
    let roomCandidates: string[] | null = null;
    if (service.roomRequired) {
      roomCandidates = service.rooms.length ? service.rooms.map((sr) => sr.room).filter((r) => valeNaUnidade(r.unitId, unitId)).sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.id) : allRooms.filter((r) => valeNaUnidade(r.unitId, unitId)).map((r) => r.id);
      if (input.roomId) {
        if (!roomCandidates.includes(input.roomId)) throw new AppointmentError(`"${service.name}" não pode ser feito nessa sala.`, "ROOM_MISMATCH");
        roomCandidates = [input.roomId];
      }
      if (roomCandidates.length === 0) throw new AppointmentError(`Nenhuma sala disponível para "${service.name}". Cadastre uma sala em Salas e recursos.`, "NO_ROOM");
    }
    const visitItem: VisitItem = {
      key: String(index), durationMinutes: totals.durationMinutes, candidates, roomCandidates,
      resources: service.resources.map((r) => ({ resourceId: r.resourceId, quantity: r.quantity })),
      bufferBeforeMinutes: service.bufferBeforeMinutes, bufferAfterMinutes: service.bufferAfterMinutes,
    };
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

  const unitId = input.unitId ? (await db.unit.findFirst({ where: { id: input.unitId, tenantId: tenant.id, active: true }, select: { id: true } }))?.id ?? null : null;
  if (input.unitId && !unitId) throw new AppointmentError("Esta unidade não está mais disponível.", "UNIT_NOT_FOUND");
  const resolved = await resolveVisitItems(tenant.id, input.items, unitId);
  const totals = visitTotals(resolved);

  const parsedPhone = parseClientPhone(input.client.phone, tenant.requirePhone);
  if (!parsedPhone.ok) throw new AppointmentError(parsedPhone.error, "INVALID_PHONE");
  const phone = parsedPhone.phone; // null = cliente sem telefone: não há WhatsApp a enviar

  // A mesma função que lista horários na página pública valida a escolha aqui.
  const slot = (await getVisitSlots({ tenant, items: resolved.map((r) => r.visitItem), dateKey, parallel: input.parallel })).find((s) => s.minutes === minutes);
  if (!slot) throw new AppointmentError("Este horário não está mais disponível. Escolha outro.", "SLOT_UNAVAILABLE");
  const placementOf = (index: number) => slot.placements.find((p) => p.key === String(index))!;
  const itemRows = resolved.map((r, index) => {
    const p = placementOf(index);
    return {
      tenantId: tenant.id,
      professionalId: p.professionalId,
      roomId: p.roomId,
      serviceId: r.service.id,
      startsAt: zonedDateTimeToUtc(dateKey, p.start, tenant.timezone),
      endsAt: zonedDateTimeToUtc(dateKey, p.end, tenant.timezone),
      sortOrder: index,
      serviceName: r.serviceName,
      durationMinutes: r.durationMinutes,
      priceCents: r.priceCents,
      bufferBeforeMinutes: r.visitItem.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: r.visitItem.bufferAfterMinutes ?? 0,
      addOns: { create: r.addOns.map((a) => ({ serviceId: a.id, name: a.name, durationMinutes: a.durationMinutes, priceCents: a.priceCents })) },
      resources: { create: (r.visitItem.resources ?? []).map((n) => ({ resourceId: n.resourceId, quantity: n.quantity })) },
    };
  });

  // Unidade da visita: a escolhida ou a do primeiro profissional que tem unidade.
  const profUnits = await db.professional.findMany({ where: { id: { in: itemRows.map((r) => r.professionalId) } }, select: { id: true, unitId: true } });
  const visitUnitId = unidadeDaVisita(unitId, itemRows.map((r) => profUnits.find((p) => p.id === r.professionalId)?.unitId ?? null));

  // Sinal via Pix: só para agendamentos da página pública. Pagou = confirmou.
  const depositCents = source === "PUBLIC" ? computeDepositCents(tenant, totals.priceCents) : 0;
  // Confirmação automática quando o profissional dispensa WhatsApp ou agenda manualmente.
  // Sem telefone não há como confirmar por WhatsApp: a reserva já nasce confirmada (senão expiraria sem resposta).
  const autoConfirm = depositCents === 0 && (source === "DASHBOARD" || !tenant.requireWhatsappConfirmation || !phone);
  const initialStatus: AppointmentStatus = depositCents > 0 ? "AWAITING_PAYMENT" : autoConfirm ? "CONFIRMED" : "PENDING";
  const paymentDeadline = new Date(Date.now() + tenant.depositTimeoutMinutes * 60_000);

  const appointment = await db.$transaction(
    async (tx) => {
      const email = input.client.email?.trim() || null;
      const nome = input.client.name.trim();
      // Com telefone, ele identifica a cliente. Sem telefone, só o e-mail identifica; sem nenhum dos dois, cada
      // reserva cria uma cliente nova (juntar pelo nome misturaria duas "Maria"). A recepção une depois, no cadastro.
      const client = phone
        ? await tx.client.upsert({
            where: { tenantId_phone: { tenantId: tenant.id, phone } },
            create: { tenantId: tenant.id, name: nome, phone, email },
            update: { name: nome, ...(email ? { email } : {}) },
          })
        : (email ? await tx.client.findFirst({ where: { tenantId: tenant.id, email, phone: null } }) : null)
            ?? await tx.client.create({ data: { tenantId: tenant.id, name: nome, phone: null, email } });

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
          unitId: visitUnitId,
          serviceName: describeVisit(resolved),
          // Simultânea: a visita dura do primeiro início ao último fim (não a soma dos serviços).
          durationMinutes: input.parallel ? Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000) : totals.durationMinutes,
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

      // Proteção contra corrida: duas clientes reservando o mesmo profissional (ou a mesma sala) ao mesmo tempo.
      // Checa item a item, porque cada um ocupa a agenda de um profissional e de uma sala diferentes.
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
        if (row.roomId) {
          // A sala conta com preparo/limpeza: compara o intervalo ocupado dos dois lados (itens da própria visita podem emendar).
          const occupied = occupiedUtc(row);
          const others = await tx.appointmentItem.findMany({
            where: { roomId: row.roomId, appointmentId: { not: created.id }, appointment: { status: { in: ACTIVE_STATUSES } }, startsAt: { lt: new Date(occupied.endsAt.getTime() + 86_400_000) }, endsAt: { gt: new Date(occupied.startsAt.getTime() - 86_400_000) } },
            select: { startsAt: true, endsAt: true, bufferBeforeMinutes: true, bufferAfterMinutes: true },
          });
          if (others.some((o) => { const oc = occupiedUtc(o); return oc.startsAt < occupied.endsAt && oc.endsAt > occupied.startsAt; })) {
            throw new AppointmentError("Esta sala acabou de ser reservada por outra pessoa.", "SLOT_UNAVAILABLE");
          }
        }
      }
      return created;
    },
    { isolationLevel: "Serializable" },
  );

  // Efeitos colaterais fora da transação: o agendamento já está garantido.
  // Pacote ativo do cliente que cubra o serviço? Reserva a sessão já.
  await vincularVisita(tenant, appointment.id);
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
      // O dia do financeiro: quando foi concluído (limpa ao reabrir).
      ...(to === "COMPLETED" ? { completedAt: new Date() } : appt.status === "COMPLETED" ? { completedAt: null } : {}),
      ...(to === "CONFIRMED" ? { confirmedAt: new Date(), expiresAt: null } : {}),
      ...(isCancel ? { cancelledAt: new Date(), cancelReason: reason ?? null, expiresAt: null } : {}),
      events: { create: { tenantId: appt.tenantId, actor, type: "STATUS_CHANGED", fromStatus: appt.status, toStatus: to, data: reason ? { reason } : undefined } },
    },
  });

  // Concluída: apura a comissão de cada item com a regra vigente (SPEC §17). Reabrir (COMPLETED → outro) limpa.
  if (to === "COMPLETED") await settleCommissions(appt.id);
  else if (appt.status === "COMPLETED") await db.appointmentItem.updateMany({ where: { appointmentId: appt.id, commissionPaidAt: null }, data: { commissionCents: null } });
  // Estoque: concluir baixa o que os serviços consomem; reabrir devolve. Falha de estoque nunca desfaz a conclusão.
  try {
    if (to === "COMPLETED") await baixarEstoqueDoAtendimento(appt.id);
    else if (appt.status === "COMPLETED") await estornarEstoqueDoAtendimento(appt.id);
  } catch (err) {
    console.error("[estoque] baixa do atendimento falhou", appt.id, err);
  }
  // Fidelidade: concluir credita o cashback; reabrir estorna. Também nunca desfaz a conclusão.
  try {
    if (to === "COMPLETED") await creditarCashbackDoAtendimento(appt.id);
    else if (appt.status === "COMPLETED") await estornarCashbackDoAtendimento(appt.id);
  } catch (err) {
    console.error("[fidelidade] cashback do atendimento falhou", appt.id, err);
  }
  // Sessões de pacote espelham o status da visita (realizada debita; cancelada libera; falta conforme a política).
  await espelharVisita(appt.id);

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
    include: { items: { orderBy: { sortOrder: "asc" }, include: { resources: { select: { resourceId: true, quantity: true } } } } },
  });
  if (!appt) throw new AppointmentError("Agendamento não encontrado.", "NOT_FOUND");
  if (!ACTIVE_STATUSES.includes(appt.status)) throw new AppointmentError("Só é possível reagendar agendamentos ativos.");

  // Mesmos profissionais, salas, recursos e durações; só a sequência é recolocada no novo início.
  const visitItems: VisitItem[] = appt.items.map((it) => ({
    key: it.id, durationMinutes: it.durationMinutes, candidates: [it.professionalId],
    roomCandidates: it.roomId ? [it.roomId] : null, resources: it.resources,
    bufferBeforeMinutes: it.bufferBeforeMinutes, bufferAfterMinutes: it.bufferAfterMinutes,
  }));
  // Visita simultânea continua simultânea ao remarcar: o modo vem de como os itens foram gravados.
  const slots = await getVisitSlots({ tenant, items: visitItems, dateKey, excludeAppointmentId: appt.id, parallel: visitIsParallel(appt.items) });
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

// ───────────── Comissões (SPEC §17) ─────────────

/**
 * Grava `commissionCents` em cada item da visita usando a regra vigente do par profissional×serviço.
 * Snapshot: mudar a comissão do profissional depois não altera visitas já concluídas.
 * Itens já acertados (commissionPaidAt) não são recalculados.
 */
export async function settleCommissions(appointmentId: string) {
  const items = await db.appointmentItem.findMany({
    where: { appointmentId, commissionPaidAt: null },
    include: {
      professional: { select: { commissionPercent: true } },
      service: { select: { professionals: { select: { professionalId: true, commissionPercent: true, commissionFixedCents: true } } } },
    },
  });
  await db.$transaction(
    items.map((it) => {
      const pair = it.service.professionals.find((ps) => ps.professionalId === it.professionalId);
      const commissionCents = commissionCentsFor(it.priceCents, {
        professionalPercent: it.professional.commissionPercent,
        overridePercent: pair?.commissionPercent,
        overrideFixedCents: pair?.commissionFixedCents,
      });
      return db.appointmentItem.update({ where: { id: it.id }, data: { commissionCents } });
    }),
  );
}

// ───────────── Acrescentar serviço a um agendamento já marcado ─────────────

const MAX_ITEMS_AFTER_EDIT = 12;

type AddServiceInput = {
  tenant: Tenant;
  appointmentId: string;
  serviceId: string;
  professionalId: string;
  addOnIds?: string[];
  /** Início do novo serviço, em minutos do dia (no fuso do estabelecimento), no mesmo dia do agendamento. */
  startMinutes: number;
  actor: AppointmentActor;
};

/**
 * Acrescenta um serviço a um agendamento ainda ativo (a cliente decidiu fazer a unha depois do cabelo).
 * O novo serviço vira mais um item da visita, no profissional e no horário escolhidos, e só entra se couber na agenda
 * desse profissional (e na sala/recursos): a mesma regra de encaixe de uma reserva nova, sem o intervalo entre atendimentos
 * em relação aos itens da própria visita. Valor, duração, fim e comissão (apurada ao concluir) acompanham os itens.
 */
export async function addServiceToAppointment(input: AddServiceInput) {
  const { tenant } = input;
  const tz = tenant.timezone;
  const appt = await db.appointment.findFirst({
    where: { id: input.appointmentId, tenantId: tenant.id },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { resources: { select: { resourceId: true, quantity: true } } } } },
  });
  if (!appt) throw new AppointmentError("Agendamento não encontrado.", "NOT_FOUND");
  if (!ACTIVE_STATUSES.includes(appt.status)) throw new AppointmentError("Só é possível acrescentar serviços a agendamentos ativos, ainda não concluídos.", "NOT_ACTIVE");
  if (appt.items.length >= MAX_ITEMS_AFTER_EDIT) throw new AppointmentError(`No máximo ${MAX_ITEMS_AFTER_EDIT} serviços por agendamento.`, "TOO_MANY_ITEMS");
  if (!Number.isInteger(input.startMinutes) || input.startMinutes < 0 || input.startMinutes > 1439) throw new AppointmentError("Horário inválido.", "BAD_TIME");

  const dateKey = toDateKey(appt.startsAt, tz);
  const [r] = await resolveVisitItems(tenant.id, [{ serviceId: input.serviceId, professionalId: input.professionalId, addOnIds: input.addOnIds }]);
  const existing: ExistingItem[] = appt.items.map((it) => ({
    professionalId: it.professionalId, roomId: it.roomId,
    start: toMinutesOfDay(it.startsAt, tz), end: toMinutesOfDay(it.endsAt, tz),
    bufferBeforeMinutes: it.bufferBeforeMinutes, bufferAfterMinutes: it.bufferAfterMinutes, resources: it.resources,
  }));
  const tentar = (start: number) => placeItemsInVisit({ tenant, items: [r.visitItem], existing, dateKey, startMinutes: start, parallel: false, excludeAppointmentId: appt.id });

  const placements = await tentar(input.startMinutes);
  if (!placements) {
    // Ajuda a recepção: o primeiro horário livre a partir do pedido, no mesmo dia.
    let sugestao: number | null = null;
    for (let m = input.startMinutes + 5; m < 1440 && sugestao == null; m += 5) if (await tentar(m)) sugestao = m;
    const nome = (await db.professional.findUnique({ where: { id: input.professionalId }, select: { name: true } }))?.name ?? "O profissional";
    throw new AppointmentError(
      sugestao != null
        ? `${nome} não está livre às ${minutesToHHMM(input.startMinutes)} para esse serviço. O primeiro horário livre é ${minutesToHHMM(sugestao)}.`
        : `${nome} não tem horário livre para esse serviço a partir das ${minutesToHHMM(input.startMinutes)} neste dia.`,
      "SLOT_UNAVAILABLE",
    );
  }
  const p = placements[0];
  const startsAt = zonedDateTimeToUtc(dateKey, p.start, tz);
  const endsAt = zonedDateTimeToUtc(dateKey, p.end, tz);

  const updated = await db.$transaction(
    async (tx) => {
      const created = await tx.appointmentItem.create({
        data: {
          tenantId: tenant.id, appointmentId: appt.id,
          professionalId: p.professionalId, roomId: p.roomId, serviceId: r.service.id,
          startsAt, endsAt, sortOrder: Math.max(-1, ...appt.items.map((i) => i.sortOrder)) + 1,
          serviceName: r.serviceName, durationMinutes: r.durationMinutes, priceCents: r.priceCents,
          bufferBeforeMinutes: r.visitItem.bufferBeforeMinutes ?? 0, bufferAfterMinutes: r.visitItem.bufferAfterMinutes ?? 0,
          addOns: { create: r.addOns.map((a) => ({ serviceId: a.id, name: a.name, durationMinutes: a.durationMinutes, priceCents: a.priceCents })) },
          resources: { create: (r.visitItem.resources ?? []).map((n) => ({ resourceId: n.resourceId, quantity: n.quantity })) },
        },
      });
      // Proteção contra corrida (outra recepção marcando o mesmo profissional/sala ao mesmo tempo).
      const concorrentes = await tx.appointmentItem.count({
        where: { professionalId: p.professionalId, id: { not: created.id }, appointmentId: { not: appt.id }, appointment: { status: { in: ACTIVE_STATUSES } }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      });
      if (concorrentes >= tenant.maxConcurrentAppointments) throw new AppointmentError("Este horário acabou de ser reservado por outra pessoa.", "SLOT_UNAVAILABLE");
      if (p.roomId) {
        const ocupada = occupiedUtc(created);
        const outras = await tx.appointmentItem.findMany({
          where: { roomId: p.roomId, id: { not: created.id }, appointment: { status: { in: ACTIVE_STATUSES } }, startsAt: { lt: new Date(ocupada.endsAt.getTime() + 86_400_000) }, endsAt: { gt: new Date(ocupada.startsAt.getTime() - 86_400_000) } },
          select: { startsAt: true, endsAt: true, bufferBeforeMinutes: true, bufferAfterMinutes: true },
        });
        if (outras.some((o) => { const oc = occupiedUtc(o); return oc.startsAt < ocupada.endsAt && oc.endsAt > ocupada.startsAt; })) {
          throw new AppointmentError("Esta sala acabou de ser reservada por outra pessoa.", "SLOT_UNAVAILABLE");
        }
      }
      const todos = await tx.appointmentItem.findMany({ where: { appointmentId: appt.id }, orderBy: { sortOrder: "asc" }, select: { serviceName: true, startsAt: true, endsAt: true } });
      const inicio = new Date(Math.min(...todos.map((i) => i.startsAt.getTime())));
      const fim = new Date(Math.max(...todos.map((i) => i.endsAt.getTime())));
      return tx.appointment.update({
        where: { id: appt.id },
        data: {
          startsAt: inicio, endsAt: fim,
          serviceName: describeVisit(todos),
          priceCents: { increment: r.priceCents },
          // Do primeiro início ao último fim: vale para visita em fila e para visita com serviços ao mesmo tempo.
          durationMinutes: Math.round((fim.getTime() - inicio.getTime()) / 60_000),
          events: { create: { tenantId: tenant.id, actor: input.actor, type: "ITEMS_ADDED", data: { serviceName: r.serviceName, professionalId: p.professionalId, startsAt: startsAt.toISOString(), priceCents: r.priceCents } } },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  // Plano de sessões ativo da cliente que cubra o serviço novo: reserva a sessão.
  await vincularVisita(tenant, appt.id);
  return updated;
}

// ───────────── Concluir com valores adicionais ─────────────

/**
 * Conclui o atendimento e lança, antes, os valores adicionais (produtos usados). A comissão é apurada só sobre os
 * serviços (`settleCommissions`); os adicionais entram no faturamento. Se a conclusão falhar, os adicionais não ficam.
 */
export async function completeAppointment(input: { appointmentId: string; tenantId: string; actor: AppointmentActor; extras: { description: string; amountCents: number }[]; paymentMethod?: PaymentMethod | null }) {
  const appt = await db.appointment.findFirst({ where: { id: input.appointmentId, tenantId: input.tenantId }, select: { id: true, status: true } });
  if (!appt) throw new AppointmentError("Agendamento não encontrado.", "NOT_FOUND");
  if (!canTransition(input.actor, appt.status, "COMPLETED")) throw new AppointmentError("Este agendamento não pode ser concluído agora.", "BAD_TRANSITION");

  const created = input.extras.length
    ? await db.$transaction(input.extras.map((e) => db.appointmentCharge.create({ data: { tenantId: input.tenantId, appointmentId: appt.id, description: e.description, amountCents: e.amountCents } })))
    : [];
  try {
    await transition({ appointmentId: appt.id, tenantId: input.tenantId, actor: input.actor, to: "COMPLETED" });
  } catch (e) {
    if (created.length) await db.appointmentCharge.deleteMany({ where: { id: { in: created.map((c) => c.id) } } });
    throw e;
  }
  if (input.paymentMethod) await db.appointment.update({ where: { id: appt.id }, data: { paymentMethod: input.paymentMethod } });
  if (created.length) {
    await db.appointmentEvent.create({
      data: { tenantId: input.tenantId, appointmentId: appt.id, actor: input.actor, type: "CHARGES_ADDED", data: { count: created.length, totalCents: created.reduce((n, c) => n + c.amountCents, 0) } },
    });
  }
  return created;
}

// ───────────── Trocar o profissional de um serviço do agendamento ─────────────

/**
 * Troca quem faz um serviço de um agendamento ativo (a cliente chegou e preferiu outro profissional). A comissão é apurada
 * ao concluir, por item, no profissional gravado nele: trocar ANTES de concluir leva a comissão a quem atendeu.
 * O novo profissional precisa fazer o serviço e estar livre no mesmo horário (agenda, sala e recursos); o horário não muda.
 * Fica registrado no histórico (quem trocou, de quem para quem).
 */
export async function changeItemProfessional(input: { tenant: Tenant; appointmentId: string; itemId: string; professionalId: string; actor: AppointmentActor }) {
  const { tenant } = input;
  const tz = tenant.timezone;
  const appt = await db.appointment.findFirst({
    where: { id: input.appointmentId, tenantId: tenant.id },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { resources: { select: { resourceId: true, quantity: true } } } } },
  });
  if (!appt) throw new AppointmentError("Agendamento não encontrado.", "NOT_FOUND");
  if (!ACTIVE_STATUSES.includes(appt.status)) throw new AppointmentError("Só dá para trocar o profissional de agendamentos ativos, antes de concluir.", "NOT_ACTIVE");
  const item = appt.items.find((i) => i.id === input.itemId);
  if (!item) throw new AppointmentError("Serviço não encontrado neste agendamento.", "NOT_FOUND");
  if (item.professionalId === input.professionalId) throw new AppointmentError("Este serviço já está com esse profissional.", "SAME_PROFESSIONAL");

  const [novo, antigo, vinculo] = await Promise.all([
    db.professional.findFirst({ where: { id: input.professionalId, tenantId: tenant.id, active: true }, select: { id: true, name: true } }),
    db.professional.findUnique({ where: { id: item.professionalId }, select: { name: true } }),
    db.professionalService.findFirst({ where: { professionalId: input.professionalId, serviceId: item.serviceId } }),
  ]);
  if (!novo) throw new AppointmentError("Profissional não encontrado.", "NOT_FOUND");
  if (!vinculo) throw new AppointmentError(`${novo.name} não realiza "${item.serviceName}".`, "PROFESSIONAL_MISMATCH");

  // O mesmo horário, agora para o novo profissional: ele precisa estar livre (e a sala/recursos do item continuam livres).
  const dateKey = toDateKey(item.startsAt, tz);
  const start = toMinutesOfDay(item.startsAt, tz);
  const end = toMinutesOfDay(item.endsAt, tz);
  const demais: ExistingItem[] = appt.items.filter((i) => i.id !== item.id).map((i) => ({
    professionalId: i.professionalId, roomId: i.roomId, start: toMinutesOfDay(i.startsAt, tz), end: toMinutesOfDay(i.endsAt, tz),
    bufferBeforeMinutes: i.bufferBeforeMinutes, bufferAfterMinutes: i.bufferAfterMinutes, resources: i.resources,
  }));
  const visitItem: VisitItem = {
    key: item.id, durationMinutes: end - start, candidates: [novo.id],
    roomCandidates: item.roomId ? [item.roomId] : null, resources: item.resources,
    bufferBeforeMinutes: item.bufferBeforeMinutes, bufferAfterMinutes: item.bufferAfterMinutes,
  };
  const placements = await placeItemsInVisit({ tenant, items: [visitItem], existing: demais, dateKey, startMinutes: start, parallel: false, excludeAppointmentId: appt.id });
  if (!placements || placements[0].start !== start) {
    throw new AppointmentError(`${novo.name} não está livre das ${minutesToHHMM(start)} às ${minutesToHHMM(end)} para esse serviço.`, "SLOT_UNAVAILABLE");
  }

  return db.$transaction(
    async (tx) => {
      // Proteção contra corrida: outra recepção marcando o novo profissional nesse horário ao mesmo tempo.
      const concorrentes = await tx.appointmentItem.count({
        where: { professionalId: novo.id, appointmentId: { not: appt.id }, appointment: { status: { in: ACTIVE_STATUSES } }, startsAt: { lt: item.endsAt }, endsAt: { gt: item.startsAt } },
      });
      if (concorrentes >= tenant.maxConcurrentAppointments) throw new AppointmentError(`${novo.name} acabou de ser reservado(a) nesse horário.`, "SLOT_UNAVAILABLE");
      const atualizado = await tx.appointmentItem.update({ where: { id: item.id }, data: { professionalId: novo.id, commissionCents: null } });
      await tx.appointmentEvent.create({
        data: {
          tenantId: tenant.id, appointmentId: appt.id, actor: input.actor, type: "PROFESSIONAL_CHANGED",
          data: { itemId: item.id, serviceName: item.serviceName, fromProfessionalId: item.professionalId, fromName: antigo?.name ?? null, toProfessionalId: novo.id, toName: novo.name },
        },
      });
      return atualizado;
    },
    { isolationLevel: "Serializable" },
  );
}

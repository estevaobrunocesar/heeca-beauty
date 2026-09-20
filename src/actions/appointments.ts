"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, resolveProfessional, type AuthContext } from "@/lib/auth/session";
import { AppointmentError, createAppointment, MAX_ITEMS_PER_VISIT, reschedule, transition } from "@/lib/appointments/service";
import { sendAppointmentMessage } from "@/lib/whatsapp/service";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { perfilDoTenant } from "@/lib/marca-atual";
import { fichaBruta, fichaDoForm, mesclarFicha } from "@/lib/clients/ficha";

function revalidateAgenda(id?: string) {
  revalidatePath("/app");
  revalidatePath("/app/agenda");
  revalidatePath("/app/clientes");
  if (id) revalidatePath(`/app/agendamentos/${id}`);
}

const errMessage = (e: unknown) => (e instanceof AppointmentError ? e.message : "Erro inesperado. Tente novamente.");

/** Carrega o agendamento garantindo tenant e permissão sobre o profissional (STAFF só vê os seus). */
async function loadAccessible(ctx: AuthContext, id: string) {
  return db.appointment.findFirst({
    // STAFF enxerga a visita se ao menos um item é seu.
    where: { id, tenantId: ctx.tenant.id, items: { some: { professionalId: { in: ctx.professionals.map((p) => p.id) } } } },
  });
}

export async function setStatusAction(id: string, to: AppointmentStatus, reason?: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!(await loadAccessible(ctx, id))) return fail("Agendamento não encontrado");
  try {
    await transition({ appointmentId: id, tenantId: ctx.tenant.id, actor: "PROFESSIONAL", to, reason });
    revalidateAgenda(id);
    return success();
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function rescheduleAction(id: string, dateKey: string, minutes: number): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!(await loadAccessible(ctx, id))) return fail("Agendamento não encontrado");
  try {
    await reschedule({ appointmentId: id, tenant: ctx.tenant, dateKey, minutes, actor: "PROFESSIONAL" });
    revalidateAgenda(id);
    return success("Reagendado!");
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function updateInternalNotesAction(id: string, notes: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!(await loadAccessible(ctx, id))) return fail("Agendamento não encontrado");
  await db.appointment.update({ where: { id }, data: { internalNotes: notes.trim() || null } });
  revalidateAgenda(id);
  return success("Observações salvas");
}

export async function resendConfirmationAction(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const appt = await loadAccessible(ctx, id);
  if (!appt) return fail("Agendamento não encontrado");
  const kind = appt.status === "CONFIRMED" ? "CONFIRMED" : "REQUEST_CONFIRMATION";
  const r = await sendAppointmentMessage(id, kind);
  revalidateAgenda(id);
  return r?.ok ? success("Mensagem reenviada") : fail(r?.error ?? "Falha ao enviar");
}

/**
 * Registro do atendimento (ficha por segmento): grava o que foi feito nesta visita e atualiza a
 * ficha da cliente com os campos preenchidos — o de hoje vira a preferência atual; vazio não apaga.
 */
export async function updateRecordAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const appt = await loadAccessible(ctx, id);
  if (!appt) return fail("Agendamento não encontrado");
  const registro = fichaDoForm(formData, perfilDoTenant(ctx.tenant).ficha);
  const client = await db.client.findUniqueOrThrow({ where: { id: appt.clientId }, select: { ficha: true } });
  await db.$transaction([
    db.appointment.update({ where: { id }, data: { registro } }),
    db.client.update({ where: { id: appt.clientId }, data: { ficha: mesclarFicha(fichaBruta(client.ficha), registro) } }),
  ]);
  revalidateAgenda(id);
  revalidatePath(`/app/clientes/${appt.clientId}`);
  return success("Registro salvo e ficha da cliente atualizada");
}

const manualItemSchema = z.object({
  serviceId: z.string().min(1, "Escolha o serviço"),
  professionalId: z.string().min(1, "Escolha o profissional"),
  addOnIds: z.array(z.string().min(1)).max(10).default([]),
});

const manualSchema = z.object({
  items: z.string().min(1, "Escolha ao menos um serviço"), // JSON de manualItemSchema[] (input hidden)
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  minutes: z.coerce.number().int().min(0).max(1439),
  clientName: z.string().trim().min(2, "Informe o nome da cliente"),
  clientPhone: z.string().trim().min(8, "Informe o WhatsApp da cliente"),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

/** Agendamento manual criado no painel (ex.: cliente ligou). Nasce CONFIRMADO. Aceita vários serviços (SPEC §11). */
export async function createManualAppointmentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  let items: z.infer<typeof manualItemSchema>[];
  try {
    const list = z.array(manualItemSchema).min(1, "Escolha ao menos um serviço").max(MAX_ITEMS_PER_VISIT).safeParse(JSON.parse(d.items));
    if (!list.success) return fail(list.error.issues[0].message);
    items = list.data;
  } catch {
    return fail("Serviços inválidos");
  }
  try {
    // STAFF só agenda para si; OWNER para qualquer profissional da equipe.
    const resolved = items.map((it) => ({ ...it, professionalId: resolveProfessional(ctx, it.professionalId).id }));
    const appt = await createAppointment({
      tenant: ctx.tenant,
      items: resolved,
      dateKey: d.dateKey,
      minutes: d.minutes,
      client: { name: d.clientName, phone: d.clientPhone },
      notes: d.notes || null,
      source: "DASHBOARD",
      actor: "PROFESSIONAL",
    });
    revalidateAgenda(appt.id);
    return success(appt.id);
  } catch (e) {
    return fail(errMessage(e));
  }
}

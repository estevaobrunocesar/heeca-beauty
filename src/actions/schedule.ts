"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, resolveProfessional } from "@/lib/auth/session";
import { dateKeyToDate, hhmmToMinutes, zonedDateTimeToUtc } from "@/lib/dates";
import { fail, success, type ActionResult } from "@/lib/action-result";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

// ───────── Folgas e horários excepcionais (dia inteiro) ─────────

const exceptionSchema = z.object({
  date: dateKey,
  kind: z.enum(["CLOSED", "CUSTOM_HOURS"]),
  start: z.string().optional().or(z.literal("")),
  end: z.string().optional().or(z.literal("")),
  reason: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function upsertExceptionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const { tenant } = ctx;
  let professional;
  try {
    professional = resolveProfessional(ctx, formData.get("professionalId")?.toString() || null);
  } catch {
    return fail("Sem permissão para este profissional.");
  }
  const parsed = exceptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  let startMinutes: number | null = null;
  let endMinutes: number | null = null;
  if (d.kind === "CUSTOM_HOURS") {
    startMinutes = hhmmToMinutes(d.start ?? "");
    endMinutes = hhmmToMinutes(d.end ?? "");
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return fail("Informe um horário excepcional válido.");
  }

  await db.scheduleException.upsert({
    where: { professionalId_date: { professionalId: professional.id, date: dateKeyToDate(d.date) } },
    create: { tenantId: tenant.id, professionalId: professional.id, date: dateKeyToDate(d.date), kind: d.kind, startMinutes, endMinutes, reason: d.reason || null },
    update: { kind: d.kind, startMinutes, endMinutes, reason: d.reason || null },
  });
  revalidatePath("/app/agenda");
  return success(d.kind === "CLOSED" ? "Folga registrada" : "Horário excepcional salvo");
}

export async function deleteExceptionAction(id: string) {
  const ctx = await requireAuth();
  await db.scheduleException.deleteMany({ where: { id, tenantId: ctx.tenant.id, professionalId: { in: ctx.professionals.map((p) => p.id) } } });
  revalidatePath("/app/agenda");
}

// ───────── Bloqueios e férias (intervalo de data/hora) ─────────

const blockSchema = z.object({
  kind: z.enum(["BLOCK", "VACATION"]),
  startDate: dateKey,
  startTime: z.string().optional().or(z.literal("")),
  endDate: dateKey,
  endTime: z.string().optional().or(z.literal("")),
  reason: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function createBlockAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const { tenant } = ctx;
  let professional;
  try {
    professional = resolveProfessional(ctx, formData.get("professionalId")?.toString() || null);
  } catch {
    return fail("Sem permissão para este profissional.");
  }
  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  // Férias: dias inteiros. Bloqueio: usa hora informada (padrão: dia inteiro).
  const startMin = d.kind === "VACATION" ? 0 : (hhmmToMinutes(d.startTime ?? "") ?? 0);
  const endMin = d.kind === "VACATION" ? 24 * 60 : (hhmmToMinutes(d.endTime ?? "") ?? 24 * 60);
  const startsAt = zonedDateTimeToUtc(d.startDate, startMin, tenant.timezone);
  const endsAt = zonedDateTimeToUtc(d.endDate, endMin, tenant.timezone);
  if (endsAt <= startsAt) return fail("O fim precisa ser depois do início.");

  await db.scheduleBlock.create({
    data: { tenantId: tenant.id, professionalId: professional.id, kind: d.kind, startsAt, endsAt, reason: d.reason || null },
  });
  revalidatePath("/app/agenda");
  return success(d.kind === "VACATION" ? "Férias registradas" : "Bloqueio criado");
}

export async function deleteBlockAction(id: string) {
  const ctx = await requireAuth();
  await db.scheduleBlock.deleteMany({ where: { id, tenantId: ctx.tenant.id, professionalId: { in: ctx.professionals.map((p) => p.id) } } });
  revalidatePath("/app/agenda");
}

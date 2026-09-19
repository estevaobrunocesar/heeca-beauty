"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/phone";
import { slugify } from "@/lib/slug";
import { fail, success, type ActionResult } from "@/lib/action-result";
import type { MessageKind } from "@/generated/prisma/enums";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp/templates";

// ───────── Dados do negócio ─────────

const businessSchema = z.object({
  businessName: z.string().trim().min(2, "Informe o nome comercial"),
  ownerName: z.string().trim().min(2, "Informe o nome do responsável"),
  slug: z.string().trim().min(3, "O link precisa ter ao menos 3 caracteres").max(40),
  description: z.string().trim().max(600).optional().or(z.literal("")),
  logoUrl: z.string().trim().url("URL do logo inválida").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
});

export async function updateBusinessAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.isOwner) return fail("Apenas a responsável pode alterar os dados do negócio.");
  const { tenant, user } = ctx;
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  const slug = slugify(d.slug);
  if (slug !== tenant.slug && (await db.tenant.findUnique({ where: { slug } }))) return fail("Este link já está em uso. Escolha outro.");

  let phone: string | null = null;
  if (d.phone) {
    phone = normalizePhone(d.phone);
    if (!phone) return fail("WhatsApp inválido");
  }

  await db.$transaction([
    db.tenant.update({
      where: { id: tenant.id },
      data: {
        businessName: d.businessName, ownerName: d.ownerName, slug,
        description: d.description || null, logoUrl: d.logoUrl || null,
        phone, address: d.address || null, city: d.city || null,
        // Aceita "@ana.nails", "ana.nails" ou a URL completa; guarda só o handle.
        instagram: d.instagram ? d.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "") || null : null,
      },
    }),
    // Mantém o nome do profissional vinculado ao responsável em sincronia
    ...(user.professional ? [db.professional.update({ where: { id: user.professional.id }, data: { name: d.ownerName } })] : []),
  ]);
  revalidatePath("/app", "layout");
  return success("Dados salvos!");
}

// ───────── Horários / regras da agenda ─────────

const rulesSchema = z.object({
  slotIntervalMinutes: z.coerce.number().int().min(5).max(120),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  minAdvanceMinutes: z.coerce.number().int().min(0).max(10080),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  pendingExpiryMinutes: z.coerce.number().int().min(0).max(10080),
  cancelDeadlineHours: z.coerce.number().int().min(0).max(168),
  reminderHoursBefore: z.coerce.number().int().min(1).max(168),
  maxConcurrentAppointments: z.coerce.number().int().min(1).max(20),
  maxDailyAppointments: z.coerce.number().int().min(0).max(50),
  requireWhatsappConfirmation: z.coerce.boolean(),
});

/** Regras de agendamento do estabelecimento. Horários semanais ficam em cada profissional. */
export async function updateScheduleAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.isOwner) return fail("Apenas a responsável pode alterar as regras.");

  const parsed = rulesSchema.safeParse({
    ...Object.fromEntries(formData),
    requireWhatsappConfirmation: formData.get("requireWhatsappConfirmation") === "on",
  });
  if (!parsed.success) return fail("Verifique os valores das regras da agenda.");
  const rules = parsed.data;

  await db.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      ...rules,
      pendingExpiryMinutes: rules.pendingExpiryMinutes === 0 ? null : rules.pendingExpiryMinutes,
      maxDailyAppointments: rules.maxDailyAppointments === 0 ? null : rules.maxDailyAppointments,
    },
  });
  revalidatePath("/app/configuracoes/horarios");
  return success("Regras salvas!");
}

// ───────── Políticas de atendimento (seção 14) ─────────

const policiesSchema = z.object({
  lateToleranceMinutes: z.coerce.number().int().min(0).max(120),
  cancellationPolicy: z.string().trim().max(600).optional().or(z.literal("")),
  reschedulePolicy: z.string().trim().max(600).optional().or(z.literal("")),
  noShowPolicy: z.string().trim().max(600).optional().or(z.literal("")),
  preServiceInstructions: z.string().trim().max(600).optional().or(z.literal("")),
  companionsAllowed: z.coerce.boolean(),
  requirePolicyAcceptance: z.coerce.boolean(),
});

export async function updatePoliciesAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.isOwner) return fail("Apenas a responsável pode alterar as políticas.");
  const parsed = policiesSchema.safeParse({
    ...Object.fromEntries(formData),
    companionsAllowed: formData.get("companionsAllowed") === "on",
    requirePolicyAcceptance: formData.get("requirePolicyAcceptance") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  await db.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      lateToleranceMinutes: d.lateToleranceMinutes,
      cancellationPolicy: d.cancellationPolicy || null,
      reschedulePolicy: d.reschedulePolicy || null,
      noShowPolicy: d.noShowPolicy || null,
      preServiceInstructions: d.preServiceInstructions || null,
      companionsAllowed: d.companionsAllowed,
      requirePolicyAcceptance: d.requirePolicyAcceptance,
    },
  });
  revalidatePath("/app/configuracoes/politicas");
  return success("Políticas salvas!");
}

// ───────── Templates de WhatsApp ─────────

const TEMPLATE_KINDS: Exclude<MessageKind, "INBOUND">[] = ["REQUEST_CONFIRMATION", "CONFIRMED", "REMINDER", "CANCELLED", "RESCHEDULED", "PAYMENT_REQUEST"];

export async function updateTemplatesAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { tenant } = await requireAuth();
  const ops = TEMPLATE_KINDS.map((kind) => {
    const body = String(formData.get(kind) ?? "").trim();
    // Igual ao padrão (ou vazio) → remove a personalização e volta a usar o default.
    if (!body || body === DEFAULT_TEMPLATES[kind]) {
      return db.messageTemplate.deleteMany({ where: { tenantId: tenant.id, kind } });
    }
    return db.messageTemplate.upsert({
      where: { tenantId_kind: { tenantId: tenant.id, kind } },
      create: { tenantId: tenant.id, kind, body },
      update: { body },
    });
  });
  await db.$transaction(ops);
  revalidatePath("/app/configuracoes/whatsapp");
  return success("Mensagens salvas!");
}

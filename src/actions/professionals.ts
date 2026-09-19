"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, requireProfessionalAccess } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { hhmmToMinutes, WEEKDAY_NAMES } from "@/lib/dates";
import { fail, success, type ActionResult } from "@/lib/action-result";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(80),
  bio: z.string().trim().max(300).optional().or(z.literal("")),
  photoUrl: z.string().trim().url("URL da foto inválida").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  specialties: z.string().trim().max(120).optional().or(z.literal("")),
  // Comissão padrão (SPEC §17): vazio = não comissionado
  commissionPercent: z.union([z.literal(""), z.coerce.number().int().min(0, "Comissão entre 0 e 100").max(100, "Comissão entre 0 e 100")]).optional(),
  active: z.coerce.boolean().optional(),
});

/** Percentual válido ou null (campo vazio / ausente). */
const pct = (v: string | number | undefined) => (v === "" || v == null ? null : Number(v));

function revalidateTeam(id?: string) {
  revalidatePath("/app", "layout"); // sidebar, agenda, dashboard usam a lista de profissionais
  if (id) revalidatePath(`/app/equipe/${id}`);
}

export async function createProfessionalAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.canManage) return fail("Apenas o responsável pode adicionar profissionais.");
  const parsed = profileSchema.safeParse({ ...Object.fromEntries(formData), active: true });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  const [last, services] = await Promise.all([
    db.professional.findFirst({ where: { tenantId: ctx.tenant.id }, orderBy: { sortOrder: "desc" } }),
    db.service.findMany({ where: { tenantId: ctx.tenant.id, deletedAt: null }, select: { id: true } }),
  ]);

  const created = await db.professional.create({
    data: {
      tenantId: ctx.tenant.id,
      name: d.name,
      bio: d.bio || null,
      photoUrl: d.photoUrl || null,
      phone: d.phone || null, email: d.email || null, specialties: d.specialties || null,
      commissionPercent: pct(d.commissionPercent),
      sortOrder: (last?.sortOrder ?? 0) + 1,
      // Novo profissional executa todos os serviços; ajuste na página dele.
      services: { create: services.map((s) => ({ serviceId: s.id })) },
      // Agenda inicial: segunda a sábado, 09:00–18:00, almoço 12:00–13:00
      availability: {
        create: [1, 2, 3, 4, 5, 6].map((weekday) => ({
          tenantId: ctx.tenant.id, weekday, startMinutes: 9 * 60, endMinutes: 18 * 60, breakStartMinutes: 12 * 60, breakEndMinutes: 13 * 60,
        })),
      },
    },
  });
  revalidateTeam(created.id);
  return success(created.id);
}

export async function updateProfessionalAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  requireProfessionalAccess(ctx, id);
  // Sem perfil de gestão, só o próprio perfil (a recepção enxerga a equipe, mas não a edita).
  if (!ctx.canManage && ctx.user.professional?.id !== id) return fail("Você só pode editar o seu próprio perfil.");
  const parsed = profileSchema.safeParse({ ...Object.fromEntries(formData), active: formData.get("active") === "on" });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  // STAFF edita só perfil; ativar/desativar, serviços e comissões são do responsável.
  const serviceIds = formData.getAll("serviceIds").map(String);
  // Comissão específica por serviço (SPEC §17): campo "commission_<serviceId>", vazio = herda a do profissional.
  const overrideFor = (serviceId: string): number | null => {
    const raw = String(formData.get(`commission_${serviceId}`) ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
  };
  await db.$transaction(async (tx) => {
    await tx.professional.update({
      where: { id },
      data: {
        name: d.name, bio: d.bio || null, photoUrl: d.photoUrl || null,
        phone: d.phone || null, email: d.email || null, specialties: d.specialties || null,
        ...(ctx.canManage ? { active: d.active ?? false, commissionPercent: pct(d.commissionPercent) } : {}),
      },
    });
    if (ctx.canManage) {
      await tx.professionalService.deleteMany({ where: { professionalId: id } });
      if (serviceIds.length) {
        const valid = await tx.service.findMany({ where: { id: { in: serviceIds }, tenantId: ctx.tenant.id }, select: { id: true } });
        await tx.professionalService.createMany({ data: valid.map((s) => ({ professionalId: id, serviceId: s.id, commissionPercent: overrideFor(s.id) })) });
      }
    }
  });
  revalidateTeam(id);
  return success("Profissional atualizado!");
}

export async function moveProfessionalAction(id: string, direction: "up" | "down") {
  const ctx = await requireAuth();
  if (!ctx.canManage) return;
  const list = await db.professional.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const idx = list.findIndex((p) => p.id === id);
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= list.length) return;
  [list[idx], list[swap]] = [list[swap], list[idx]];
  await db.$transaction(list.map((p, i) => db.professional.update({ where: { id: p.id }, data: { sortOrder: i } })));
  revalidateTeam();
}

/** Horário semanal de um profissional (campos day_<n>_enabled/start/end/breakStart/breakEnd). */
export async function updateProfessionalHoursAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  requireProfessionalAccess(ctx, id);

  const weekly: { weekday: number; startMinutes: number; endMinutes: number; breakStartMinutes: number | null; breakEndMinutes: number | null }[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    if (formData.get(`day_${weekday}_enabled`) !== "on") continue;
    const start = hhmmToMinutes(String(formData.get(`day_${weekday}_start`) ?? ""));
    const end = hhmmToMinutes(String(formData.get(`day_${weekday}_end`) ?? ""));
    if (start == null || end == null || end <= start) return fail(`Horário inválido em ${WEEKDAY_NAMES[weekday].toLowerCase()}.`);
    const bs = hhmmToMinutes(String(formData.get(`day_${weekday}_breakStart`) ?? ""));
    const be = hhmmToMinutes(String(formData.get(`day_${weekday}_breakEnd`) ?? ""));
    const hasBreak = bs != null && be != null;
    if (hasBreak && (bs <= start || be >= end || be <= bs)) return fail(`Intervalo de almoço inválido em ${WEEKDAY_NAMES[weekday].toLowerCase()}.`);
    weekly.push({ weekday, startMinutes: start, endMinutes: end, breakStartMinutes: hasBreak ? bs : null, breakEndMinutes: hasBreak ? be : null });
  }

  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { professionalId: id } }),
    db.availabilityRule.createMany({ data: weekly.map((w) => ({ ...w, tenantId: ctx.tenant.id, professionalId: id })) }),
  ]);
  revalidateTeam(id);
  return success("Horários salvos!");
}

// ───────── Acesso (login) do profissional ─────────

const accessSchema = z.object({
  email: z.string().trim().email("E-mail inválido").toLowerCase(),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").optional().or(z.literal("")),
  // Perfil (SPEC §6). O login fica sempre vinculado a uma pessoa da equipe; quem não atende (recepção) fica inativo na agenda.
  role: z.enum(["STAFF", "RECEPTION", "MANAGER"]).default("STAFF"),
});

/** Cria ou atualiza o login vinculado ao profissional, com o perfil escolhido (STAFF, RECEPTION ou MANAGER). */
export async function setProfessionalAccessAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.isOwner) return fail("Apenas o responsável pode gerenciar acessos.");
  const pro = requireProfessionalAccess(ctx, id);
  const parsed = accessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { email, password, role } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.id !== pro.userId) return fail("Este e-mail já está em uso por outra conta.");

  if (pro.userId) {
    const current = await db.user.findUnique({ where: { id: pro.userId }, select: { role: true } });
    if (current?.role === "OWNER") return fail("O perfil do responsável não muda por aqui.");
    await db.user.update({
      where: { id: pro.userId },
      data: { email, name: pro.name, role, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
    });
  } else {
    if (!password) return fail("Defina uma senha inicial para o novo acesso.");
    const user = await db.user.create({
      data: { tenantId: ctx.tenant.id, name: pro.name, email, passwordHash: await hashPassword(password), role },
    });
    await db.professional.update({ where: { id }, data: { userId: user.id } });
  }
  revalidateTeam(id);
  return success("Acesso salvo!");
}

export async function removeProfessionalAccessAction(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.isOwner) return fail("Apenas o responsável pode gerenciar acessos.");
  const pro = requireProfessionalAccess(ctx, id);
  if (!pro.userId) return success();
  if (pro.userId === ctx.user.id) return fail("Você não pode remover o seu próprio acesso.");
  const user = await db.user.findUnique({ where: { id: pro.userId } });
  if (user?.role === "OWNER") return fail("O acesso do responsável não pode ser removido por aqui.");
  await db.user.delete({ where: { id: pro.userId } }); // professional.userId vira null (SetNull)
  revalidateTeam(id);
  return success("Acesso removido.");
}

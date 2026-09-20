"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { zonedDateTimeToUtc } from "@/lib/dates";

/**
 * Salas e recursos (opção "agenda por sala" do estabelecimento — Tenant.salasAtivas).
 * Sala = onde o serviço acontece (uma por vez). Recurso = equipamento compartilhado com quantidade
 * (2 macas, 1 banheira). Bloqueio de sala/recurso = manutenção. Só dono e gerente mexem aqui.
 */
const revalidate = () => { revalidatePath("/app/salas"); revalidatePath("/app/agenda"); revalidatePath("/app/servicos"); };

async function manager() {
  const ctx = await requireAuth();
  if (!ctx.canManage) throw new Error("Apenas a responsável pode gerenciar salas e recursos.");
  return ctx;
}

// ───────── Opção do estabelecimento ─────────

export async function setSalasAtivasAction(ativas: boolean): Promise<ActionResult> {
  const ctx = await manager();
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { salasAtivas: ativas } });
  revalidate();
  revalidatePath("/app/configuracoes/segmentos");
  revalidatePath("/app", "layout");
  return success(ativas ? "Agenda por sala ligada! Cadastre suas salas em Salas e recursos." : "Agenda por sala desligada.");
}

// ───────── Salas ─────────

const roomSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da sala").max(60),
  kind: z.string().trim().max(40).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(20).default(1),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function createRoomAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const p = roomSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0].message);
  const last = await db.room.findFirst({ where: { tenantId: ctx.tenant.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await db.room.create({ data: { tenantId: ctx.tenant.id, name: p.data.name, kind: p.data.kind || null, capacity: p.data.capacity, description: p.data.description || null, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  revalidate();
  return success("Sala criada!");
}

export async function updateRoomAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const p = roomSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0].message);
  const r = await db.room.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { name: p.data.name, kind: p.data.kind || null, capacity: p.data.capacity, description: p.data.description || null } });
  if (r.count === 0) return fail("Sala não encontrada");
  revalidate();
  return success("Sala atualizada!");
}

/** Desativar (não apagar): itens já agendados continuam apontando para a sala; o motor deixa de oferecê-la. */
export async function toggleRoomAction(id: string) {
  const ctx = await manager();
  const room = await db.room.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { active: true } });
  if (!room) return;
  await db.room.update({ where: { id }, data: { active: !room.active } });
  revalidate();
}

export async function moveRoomAction(id: string, direction: "up" | "down") {
  const ctx = await manager();
  const rooms = await db.room.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = rooms.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rooms.length) return;
  [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
  await db.$transaction(rooms.map((r, sortOrder) => db.room.update({ where: { id: r.id }, data: { sortOrder } })));
  revalidate();
}

// ───────── Recursos ─────────

const resourceSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do recurso").max(60),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima: 1").max(99),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function createResourceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const p = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0].message);
  const last = await db.resource.findFirst({ where: { tenantId: ctx.tenant.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await db.resource.create({ data: { tenantId: ctx.tenant.id, name: p.data.name, quantity: p.data.quantity, description: p.data.description || null, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  revalidate();
  return success("Recurso criado!");
}

export async function updateResourceAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const p = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0].message);
  const r = await db.resource.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { name: p.data.name, quantity: p.data.quantity, description: p.data.description || null } });
  if (r.count === 0) return fail("Recurso não encontrado");
  revalidate();
  return success("Recurso atualizado!");
}

export async function toggleResourceAction(id: string) {
  const ctx = await manager();
  const res = await db.resource.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { active: true } });
  if (!res) return;
  await db.resource.update({ where: { id }, data: { active: !res.active } });
  revalidate();
}

// ───────── Bloqueios de sala/recurso (manutenção) ─────────

const blockSchema = z.object({
  target: z.string().regex(/^(room|resource):[a-z0-9]+$/i, "Escolha a sala ou o recurso"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  startMinutes: z.coerce.number().int().min(0).max(1439),
  endMinutes: z.coerce.number().int().min(1).max(1440),
  reason: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function createRoomBlockAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const p = blockSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0].message);
  const { target, date, startMinutes, endMinutes, reason } = p.data;
  if (endMinutes <= startMinutes) return fail("O fim precisa ser depois do início.");
  const [kind, id] = target.split(":");
  const owned = kind === "room"
    ? await db.room.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { id: true } })
    : await db.resource.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { id: true } });
  if (!owned) return fail("Sala ou recurso não encontrado");
  await db.scheduleBlock.create({
    data: {
      tenantId: ctx.tenant.id, kind: "BLOCK", reason: reason || null,
      ...(kind === "room" ? { roomId: id } : { resourceId: id }),
      startsAt: zonedDateTimeToUtc(date, startMinutes, ctx.tenant.timezone),
      endsAt: zonedDateTimeToUtc(date, endMinutes, ctx.tenant.timezone),
    },
  });
  revalidate();
  return success("Bloqueio criado!");
}

export async function deleteRoomBlockAction(id: string) {
  const ctx = await manager();
  await db.scheduleBlock.deleteMany({ where: { id, tenantId: ctx.tenant.id, OR: [{ roomId: { not: null } }, { resourceId: { not: null } }] } });
  revalidate();
}

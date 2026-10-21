"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { normalizePhone } from "@/lib/phone";

/** Unidades (filiais) do estabelecimento. Só dono e gerente. Com 0 ou 1 unidade ativa nada muda para quem agenda. */
const revalidate = () => {
  revalidatePath("/app/configuracoes/unidades");
  revalidatePath("/app/equipe");
  revalidatePath("/app/salas");
  revalidatePath("/app/agenda");
};

async function manager() {
  const ctx = await requireAuth();
  if (!ctx.can("configuracoes")) throw new Error("Sem permissão para gerenciar as unidades.");
  return ctx;
}

const unitSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da unidade").max(60, "Nome muito longo"),
  address: z.string().trim().max(200, "Endereço muito longo").optional(),
  phone: z.string().trim().optional(),
});

function readUnit(formData: FormData) {
  const p = unitSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message, data: null };
  let phone: string | null = null;
  if (p.data.phone) {
    phone = normalizePhone(p.data.phone);
    if (!phone) return { error: "Telefone da unidade inválido. Use DDD + número.", data: null };
  }
  return { error: null, data: { name: p.data.name, address: p.data.address || null, phone } };
}

const isUniqueClash = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";

export async function createUnitAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const read = readUnit(formData);
  if (!read.data) return fail(read.error);
  const last = await db.unit.findFirst({ where: { tenantId: ctx.tenant.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  try {
    await db.unit.create({ data: { tenantId: ctx.tenant.id, ...read.data, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  } catch (err) {
    if (isUniqueClash(err)) return fail("Já existe uma unidade com esse nome.");
    throw err;
  }
  revalidate();
  return success("Unidade criada!");
}

export async function updateUnitAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const read = readUnit(formData);
  if (!read.data) return fail(read.error);
  try {
    const r = await db.unit.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: read.data });
    if (r.count === 0) return fail("Unidade não encontrada");
  } catch (err) {
    if (isUniqueClash(err)) return fail("Já existe uma unidade com esse nome.");
    throw err;
  }
  revalidate();
  return success("Unidade atualizada!");
}

/** Desativar tira a unidade da página pública; profissionais e salas dela continuam ligados e o histórico fica. */
export async function toggleUnitAction(id: string): Promise<ActionResult> {
  const ctx = await manager();
  const u = await db.unit.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { active: true } });
  if (!u) return fail("Unidade não encontrada");
  await db.unit.update({ where: { id }, data: { active: !u.active } });
  revalidate();
  return success(u.active ? "Unidade desativada." : "Unidade reativada.");
}

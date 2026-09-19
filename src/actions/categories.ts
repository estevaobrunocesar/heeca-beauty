"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { categorySlug } from "@/lib/services/categories";

const nameSchema = z.string().trim().min(2, "Informe o nome da categoria").max(40, "Nome muito longo");

async function owner() {
  const ctx = await requireAuth();
  return ctx.canManage ? ctx : null;
}

/** Slug único dentro do tenant ("cabelo", "cabelo-2", …). */
async function uniqueSlug(tenantId: string, name: string, ignoreId?: string) {
  const base = categorySlug(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await db.serviceCategory.findFirst({ where: { tenantId, slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
}

export async function createCategoryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return fail("Apenas a pessoa responsável pode gerenciar categorias.");
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const last = await db.serviceCategory.findFirst({ where: { tenantId: ctx.tenant.id }, orderBy: { sortOrder: "desc" } });
  await db.serviceCategory.create({
    data: { tenantId: ctx.tenant.id, name: parsed.data, slug: await uniqueSlug(ctx.tenant.id, parsed.data), sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidatePath("/app/servicos");
  return success("Categoria criada!");
}

export async function renameCategoryAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return fail("Apenas a pessoa responsável pode gerenciar categorias.");
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const res = await db.serviceCategory.updateMany({
    where: { id, tenantId: ctx.tenant.id },
    data: { name: parsed.data, slug: await uniqueSlug(ctx.tenant.id, parsed.data, id) },
  });
  if (res.count === 0) return fail("Categoria não encontrada");
  revalidatePath("/app/servicos");
  revalidatePath(`/agendar/${ctx.tenant.slug}`);
  return success("Categoria renomeada!");
}

/** Excluir não apaga serviços: eles ficam "sem categoria" (FK com SetNull). */
export async function deleteCategoryAction(id: string) {
  const ctx = await owner();
  if (!ctx) return;
  await db.serviceCategory.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  revalidatePath("/app/servicos");
  revalidatePath(`/agendar/${ctx.tenant.slug}`);
}

export async function moveCategoryAction(id: string, direction: "up" | "down") {
  const ctx = await owner();
  if (!ctx) return;
  const list = await db.serviceCategory.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const idx = list.findIndex((c) => c.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= list.length) return;
  [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
  await db.$transaction(list.map((c, i) => db.serviceCategory.update({ where: { id: c.id }, data: { sortOrder: i } })));
  revalidatePath("/app/servicos");
}

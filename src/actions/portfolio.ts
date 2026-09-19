"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { ownedCategoryId } from "@/lib/services/categories-db";

const itemSchema = z.object({
  imageUrl: z.string().trim().url("Informe a URL da foto"),
  title: z.string().trim().min(2, "Informe o nome do procedimento").max(80),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  categoryId: z.string().trim().max(40).optional().or(z.literal("")),
  visible: z.coerce.boolean().optional(),
});

function parse(formData: FormData) {
  const parsed = itemSchema.safeParse({ ...Object.fromEntries(formData), visible: formData.get("visible") === "on" });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  return { ok: true as const, data: { imageUrl: d.imageUrl, title: d.title, description: d.description || null, categoryId: d.categoryId || null, visible: d.visible ?? true } };
}

async function owner() {
  const ctx = await requireAuth();
  if (!ctx.canManage) return null;
  return ctx;
}

export async function createPortfolioItemAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return fail("Apenas a responsável pode gerenciar o portfólio.");
  const r = parse(formData);
  if (!r.ok) return fail(r.error);
  r.data.categoryId = await ownedCategoryId(ctx.tenant.id, r.data.categoryId);
  // Foto nova aparece primeiro na galeria (sortOrder menor = mais recente).
  const first = await db.portfolioItem.findFirst({ where: { tenantId: ctx.tenant.id }, orderBy: { sortOrder: "asc" } });
  await db.portfolioItem.create({ data: { ...r.data, tenantId: ctx.tenant.id, sortOrder: (first?.sortOrder ?? 1) - 1 } });
  revalidatePath("/app/portfolio");
  revalidatePath(`/agendar/${ctx.tenant.slug}`);
  return success("Foto publicada!");
}

export async function updatePortfolioItemAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return fail("Apenas a responsável pode gerenciar o portfólio.");
  const r = parse(formData);
  if (!r.ok) return fail(r.error);
  r.data.categoryId = await ownedCategoryId(ctx.tenant.id, r.data.categoryId);
  const res = await db.portfolioItem.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: r.data });
  if (res.count === 0) return fail("Foto não encontrada");
  revalidatePath("/app/portfolio");
  revalidatePath(`/agendar/${ctx.tenant.slug}`);
  return success("Foto atualizada!");
}

export async function togglePortfolioItemAction(id: string) {
  const ctx = await owner();
  if (!ctx) return;
  const item = await db.portfolioItem.findFirst({ where: { id, tenantId: ctx.tenant.id } });
  if (!item) return;
  await db.portfolioItem.update({ where: { id }, data: { visible: !item.visible } });
  revalidatePath("/app/portfolio");
  revalidatePath(`/agendar/${ctx.tenant.slug}`);
}

export async function deletePortfolioItemAction(id: string) {
  const ctx = await owner();
  if (!ctx) return;
  await db.portfolioItem.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  revalidatePath("/app/portfolio");
  revalidatePath(`/agendar/${ctx.tenant.slug}`);
}

export async function movePortfolioItemAction(id: string, direction: "up" | "down") {
  const ctx = await owner();
  if (!ctx) return;
  const list = await db.portfolioItem.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }] });
  const idx = list.findIndex((s) => s.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= list.length) return;
  [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
  await db.$transaction(list.map((s, i) => db.portfolioItem.update({ where: { id: s.id }, data: { sortOrder: i } })));
  revalidatePath("/app/portfolio");
  revalidatePath(`/agendar/${ctx.tenant.slug}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { parseMoneyToCents } from "@/lib/money";
import { ownedCategoryId } from "@/lib/services/categories-db";
import { desvincularItem, regraFaltaDe, sincronizarStatus, vincularItem } from "@/lib/packages/service";
import { vencimento } from "@/lib/packages/rules";

/** Pacotes de sessões: catálogo (o que se vende), venda a um cliente e vínculo manual de atendimentos. Dono e gerente. */
const revalidate = (id?: string) => { revalidatePath("/app/pacotes"); revalidatePath("/app/clientes"); if (id) revalidatePath(`/app/pacotes/${id}`); };

async function manager() {
  const ctx = await requireAuth();
  if (!ctx.canManage) throw new Error("Apenas a responsável pode gerenciar pacotes.");
  return ctx;
}

// ───────── Catálogo ─────────

const packageSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do pacote").max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  scope: z.string().regex(/^(any|service:[a-z0-9]+|category:[a-z0-9]+)$/i, "Escolha o que o pacote cobre"),
  sessionsCount: z.coerce.number().int().min(1, "Ao menos 1 sessão").max(200),
  validityDays: z.coerce.number().int().min(0).max(3650).optional(),
  price: z.string().trim().min(1, "Informe o preço"),
  onlineVisible: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
});

async function parsePackage(tenantId: string, formData: FormData) {
  const p = packageSchema.safeParse({ ...Object.fromEntries(formData), onlineVisible: formData.get("onlineVisible") === "on", active: formData.get("active") === "on" });
  if (!p.success) return { ok: false as const, error: p.error.issues[0].message };
  const priceCents = parseMoneyToCents(p.data.price);
  if (priceCents == null) return { ok: false as const, error: "Preço inválido" };
  const [kind, id] = p.data.scope.split(":");
  let serviceId: string | null = null, categoryId: string | null = null;
  if (kind === "service") {
    const s = await db.service.findFirst({ where: { id, tenantId, deletedAt: null, isAddOn: false }, select: { id: true } });
    if (!s) return { ok: false as const, error: "Serviço não encontrado" };
    serviceId = s.id;
  } else if (kind === "category") {
    categoryId = await ownedCategoryId(tenantId, id);
    if (!categoryId) return { ok: false as const, error: "Categoria não encontrada" };
  }
  return { ok: true as const, data: { name: p.data.name, description: p.data.description || null, serviceId, categoryId, sessionsCount: p.data.sessionsCount, validityDays: p.data.validityDays || null, priceCents, onlineVisible: p.data.onlineVisible ?? false, active: p.data.active ?? true } };
}

export async function createPackageAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const r = await parsePackage(ctx.tenant.id, formData);
  if (!r.ok) return fail(r.error);
  const last = await db.package.findFirst({ where: { tenantId: ctx.tenant.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await db.package.create({ data: { ...r.data, tenantId: ctx.tenant.id, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  revalidate();
  return success("Pacote criado!");
}

export async function updatePackageAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const r = await parsePackage(ctx.tenant.id, formData);
  if (!r.ok) return fail(r.error);
  const res = await db.package.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: r.data });
  if (res.count === 0) return fail("Pacote não encontrado");
  revalidate();
  return success("Pacote atualizado!");
}

export async function togglePackageAction(id: string) {
  const ctx = await manager();
  const p = await db.package.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { active: true } });
  if (!p) return;
  await db.package.update({ where: { id }, data: { active: !p.active } });
  revalidate();
}

// ───────── Venda ─────────

const saleSchema = z.object({
  clientId: z.string().min(1, "Escolha o cliente"),
  packageId: z.string().min(1, "Escolha o pacote"),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  price: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

/** Vende um pacote do catálogo a um cliente: snapshot (escopo, sessões, validade, preço — editável na venda). */
export async function sellPackageAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const p = saleSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0].message);
  const [client, pkg] = await Promise.all([
    db.client.findFirst({ where: { id: p.data.clientId, tenantId: ctx.tenant.id }, select: { id: true } }),
    db.package.findFirst({ where: { id: p.data.packageId, tenantId: ctx.tenant.id, active: true } }),
  ]);
  if (!client) return fail("Cliente não encontrado");
  if (!pkg) return fail("Pacote não encontrado");
  const priceCents = p.data.price ? parseMoneyToCents(p.data.price) : pkg.priceCents;
  if (priceCents == null) return fail("Preço inválido");
  const startsAt = new Date(`${p.data.startsAt}T00:00:00Z`);
  const sold = await db.clientPackage.create({
    data: {
      tenantId: ctx.tenant.id, clientId: client.id, packageId: pkg.id, serviceId: pkg.serviceId, categoryId: pkg.categoryId,
      name: pkg.name, sessionsTotal: pkg.sessionsCount, startsAt, expiresAt: vencimento(startsAt, pkg.validityDays), priceCents, notes: p.data.notes || null,
    },
  });
  revalidate(sold.id);
  redirect(`/app/pacotes/${sold.id}`);
}

export async function cancelClientPackageAction(id: string) {
  const ctx = await manager();
  const r = await db.clientPackage.updateMany({ where: { id, tenantId: ctx.tenant.id, status: { in: ["ACTIVE", "EXPIRED"] } }, data: { status: "CANCELLED", closedAt: new Date() } });
  if (r.count) revalidate(id);
}

export async function reopenClientPackageAction(id: string) {
  const ctx = await manager();
  const r = await db.clientPackage.updateMany({ where: { id, tenantId: ctx.tenant.id, status: "CANCELLED" }, data: { status: "ACTIVE", closedAt: null } });
  if (r.count) { await sincronizarStatus(ctx.tenant.id, id, regraFaltaDe(ctx.tenant)); revalidate(id); }
}

// ───────── Sessões ─────────

export async function linkItemAction(clientPackageId: string, itemId: string): Promise<ActionResult> {
  const ctx = await manager();
  try {
    await vincularItem(ctx.tenant, clientPackageId, itemId);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível vincular");
  }
  revalidate(clientPackageId);
  revalidatePath("/app/agendamentos");
  return success("Atendimento vinculado ao pacote");
}

export async function unlinkItemAction(clientPackageId: string, itemId: string) {
  const ctx = await manager();
  await desvincularItem(ctx.tenant, itemId);
  revalidate(clientPackageId);
  revalidatePath("/app/agendamentos");
}

export async function setFaltaConsomeSessaoAction(consome: boolean): Promise<ActionResult> {
  const ctx = await manager();
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { faltaConsomeSessao: consome } });
  revalidate();
  return success(consome ? "Falta passa a descontar a sessão." : "Falta não desconta mais a sessão.");
}

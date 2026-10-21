"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { parseMoneyToCents } from "@/lib/money";
import { MAX_QUANTITY, UNITS, movimentoManual, parseQuantidade } from "@/lib/stock/rules";

/** Estoque de produtos: só dono e gerente mexem. A baixa por atendimento é automática (lib/stock/db.ts). */
const revalidate = () => { revalidatePath("/app/estoque"); revalidatePath("/app"); revalidatePath("/app/servicos"); };

async function manager() {
  const ctx = await requireAuth();
  if (!ctx.can("estoque")) throw new Error("Sem permissão para o estoque.");
  return ctx;
}

const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto").max(80, "Nome muito longo"),
  unit: z.enum(UNITS, { message: "Escolha a unidade" }),
  minQuantity: z.string().trim().optional(),
  cost: z.string().trim().optional(),
  notes: z.string().trim().max(300, "Observação muito longa").optional(),
});

function readProduct(formData: FormData) {
  const p = productSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message, data: null };
  const min = p.data.minQuantity ? parseQuantidade(p.data.minQuantity) : 0;
  if (min == null) return { error: "O estoque mínimo precisa ser um número inteiro.", data: null };
  let costCents: number | null = null;
  if (p.data.cost) {
    costCents = parseMoneyToCents(p.data.cost);
    if (costCents == null || costCents < 0) return { error: "Custo inválido. Use o formato 12,50.", data: null };
  }
  return { error: null, data: { name: p.data.name, unit: p.data.unit, minQuantity: min, costCents, notes: p.data.notes || null } };
}

const isUniqueClash = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";

export async function createProductAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const read = readProduct(formData);
  if (!read.data) return fail(read.error);
  const inicial = String(formData.get("initial") ?? "").trim();
  const qtd = inicial ? parseQuantidade(inicial) : 0;
  if (qtd == null) return fail("A quantidade em estoque precisa ser um número inteiro.");
  try {
    await db.product.create({
      data: {
        tenantId: ctx.tenant.id, ...read.data,
        // Estoque que já existe ao cadastrar entra como a primeira movimentação (o saldo é sempre a soma delas).
        ...(qtd > 0 ? { movements: { create: { tenantId: ctx.tenant.id, kind: "ADJUSTMENT", quantity: qtd, note: "Estoque inicial", userId: ctx.user.id } } } : {}),
      },
    });
  } catch (err) {
    if (isUniqueClash(err)) return fail("Já existe um produto com esse nome.");
    throw err;
  }
  revalidate();
  return success("Produto cadastrado!");
}

export async function updateProductAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const read = readProduct(formData);
  if (!read.data) return fail(read.error);
  try {
    const r = await db.product.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: read.data });
    if (r.count === 0) return fail("Produto não encontrado");
  } catch (err) {
    if (isUniqueClash(err)) return fail("Já existe um produto com esse nome.");
    throw err;
  }
  revalidate();
  return success("Produto atualizado!");
}

/** Desativar tira o produto das listas e da baixa automática; o histórico e o saldo ficam. */
export async function toggleProductAction(id: string): Promise<ActionResult> {
  const ctx = await manager();
  const p = await db.product.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { active: true } });
  if (!p) return fail("Produto não encontrado");
  await db.product.update({ where: { id }, data: { active: !p.active } });
  revalidate();
  return success(p.active ? "Produto desativado." : "Produto reativado.");
}

const moveSchema = z.object({
  kind: z.enum(["PURCHASE", "LOSS", "ADJUSTMENT"], { message: "Escolha o tipo do lançamento" }),
  quantity: z.string().trim().min(1, "Informe a quantidade"),
  cost: z.string().trim().optional(),
  note: z.string().trim().max(200, "Observação muito longa").optional(),
});

export async function moveStockAction(productId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const p = moveSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0].message);
  const quantity = parseQuantidade(p.data.quantity);
  if (quantity == null) return fail(`Informe um número inteiro de 0 a ${MAX_QUANTITY.toLocaleString("pt-BR")}.`);
  let unitCostCents: number | null = null;
  if (p.data.kind === "PURCHASE" && p.data.cost) {
    unitCostCents = parseMoneyToCents(p.data.cost);
    if (unitCostCents == null || unitCostCents < 0) return fail("Custo inválido. Use o formato 12,50.");
  }

  const product = await db.product.findFirst({ where: { id: productId, tenantId: ctx.tenant.id }, select: { id: true } });
  if (!product) return fail("Produto não encontrado");

  // Serializable: dois lançamentos ao mesmo tempo não podem passar do saldo juntos.
  const result = await db.$transaction(async (tx) => {
    const agg = await tx.stockMovement.aggregate({ where: { productId, tenantId: ctx.tenant.id }, _sum: { quantity: true } });
    const m = movimentoManual({ kind: p.data.kind, quantity, saldoAtual: agg._sum.quantity ?? 0 });
    if (!m.ok) return m;
    await tx.stockMovement.create({
      data: { tenantId: ctx.tenant.id, productId, kind: p.data.kind, quantity: m.delta, unitCostCents, note: p.data.note || null, userId: ctx.user.id },
    });
    // Entrada com custo atualiza o custo do produto (o último preço pago).
    if (unitCostCents != null) await tx.product.update({ where: { id: productId }, data: { costCents: unitCostCents } });
    return m;
  }, { isolationLevel: "Serializable" });
  if (!result.ok) return fail(result.error);

  revalidate();
  return success(p.data.kind === "PURCHASE" ? "Entrada registrada." : p.data.kind === "LOSS" ? "Saída registrada." : "Contagem acertada.");
}

/** Substitui a lista de produtos que um atendimento do serviço consome. */
export async function saveServiceProductsAction(serviceId: string, lines: { productId: string; quantity: string }[]): Promise<ActionResult> {
  const ctx = await manager();
  const service = await db.service.findFirst({ where: { id: serviceId, tenantId: ctx.tenant.id, deletedAt: null }, select: { id: true } });
  if (!service) return fail("Serviço não encontrado");

  const ids = new Set<string>();
  const rows: { productId: string; quantity: number }[] = [];
  for (const l of lines) {
    if (!l.productId && !l.quantity.trim()) continue; // linha vazia
    const quantity = parseQuantidade(l.quantity);
    if (!l.productId || quantity == null || quantity <= 0) return fail("Cada produto precisa de uma quantidade inteira maior que zero.");
    if (ids.has(l.productId)) return fail("Há um produto repetido na lista.");
    ids.add(l.productId);
    rows.push({ productId: l.productId, quantity });
  }
  const validos = await db.product.count({ where: { tenantId: ctx.tenant.id, id: { in: [...ids] } } });
  if (validos !== ids.size) return fail("Um dos produtos não existe mais.");

  await db.$transaction([
    db.serviceProduct.deleteMany({ where: { serviceId } }),
    db.serviceProduct.createMany({ data: rows.map((r) => ({ tenantId: ctx.tenant.id, serviceId, ...r })) }),
  ]);
  revalidate();
  return success(rows.length ? "Produtos do serviço salvos." : "Este serviço não consome produtos.");
}


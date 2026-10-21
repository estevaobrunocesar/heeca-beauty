"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { parseMoneyToCents } from "@/lib/money";
import { todayKey } from "@/lib/dates";
import { caixaAbertoDe, situacaoDoCaixa } from "@/lib/finance/db";
import { diaDaDespesa, diferencaDoCaixa, isMethod, METHODS } from "@/lib/finance/rules";

/** Financeiro (despesas): dono e gerente. Caixa: também a recepção. */
const revalidate = () => { revalidatePath("/app/financeiro"); revalidatePath("/app/caixa"); revalidatePath("/app"); };
const MAX_CENTS = 10_000_000 * 100;

async function manager() {
  const ctx = await requireAuth();
  if (!ctx.can("financeiro")) throw new Error("Sem permissão para o financeiro.");
  return ctx;
}
async function frontDesk() {
  const ctx = await requireAuth();
  if (!ctx.can("caixa")) throw new Error("Sem permissão para operar o caixa.");
  return ctx;
}
const money = (v: unknown, { allowZero = false } = {}) => {
  const c = typeof v === "string" ? parseMoneyToCents(v) : null;
  return c == null || c < 0 || c > MAX_CENTS || (!allowZero && c === 0) ? null : c;
};

// ───────── Despesas ─────────

const expenseSchema = z.object({
  description: z.string().trim().min(2, "Descreva a despesa").max(120, "Descrição muito longa"),
  category: z.string().trim().min(1, "Escolha a categoria").max(40),
  amount: z.string().trim().min(1, "Informe o valor"),
  method: z.enum(METHODS, { message: "Escolha a forma de pagamento" }),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  notes: z.string().trim().max(300).optional(),
});

export async function addExpenseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await manager();
  const p = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return fail(p.error.issues[0].message);
  const amountCents = money(p.data.amount);
  if (amountCents == null) return fail("Valor inválido. Use o formato 150,00.");
  if (p.data.day > todayKey(ctx.tenant.timezone)) return fail("A data da despesa não pode ser futura.");

  // Despesa em dinheiro paga com o caixa aberto sai da gaveta.
  const caixa = p.data.method === "CASH" ? await caixaAbertoDe(ctx.tenant.id) : null;
  await db.expense.create({
    data: {
      tenantId: ctx.tenant.id, description: p.data.description, category: p.data.category, amountCents, method: p.data.method,
      spentAt: diaDaDespesa(p.data.day), notes: p.data.notes || null, cashSessionId: caixa?.id ?? null, createdById: ctx.user.id,
    },
  });
  revalidate();
  return success(caixa ? "Despesa lançada e descontada do caixa aberto." : "Despesa lançada.");
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  const ctx = await manager();
  const r = await db.expense.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  if (r.count === 0) return fail("Despesa não encontrada");
  revalidate();
  return success("Despesa removida.");
}

// ───────── Forma de pagamento do atendimento ─────────

export async function setPaymentMethodAction(appointmentId: string, method: string | null): Promise<ActionResult> {
  const ctx = await frontDesk();
  if (method !== null && !isMethod(method)) return fail("Forma de pagamento inválida");
  const r = await db.appointment.updateMany({ where: { id: appointmentId, tenantId: ctx.tenant.id, status: "COMPLETED" }, data: { paymentMethod: method } });
  if (r.count === 0) return fail("Só dá para informar o pagamento de um atendimento concluído.");
  revalidate();
  revalidatePath(`/app/agendamentos/${appointmentId}`);
  return success("Forma de pagamento salva.");
}

// ───────── Caixa ─────────

export async function openCashAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await frontDesk();
  const opening = money(String(formData.get("opening") || "0"), { allowZero: true });
  if (opening == null) return fail("Valor do troco inválido. Use o formato 100,00.");
  // Serializable: duas pessoas abrindo ao mesmo tempo não criam dois caixas.
  const r = await db.$transaction(async (tx) => {
    const aberto = await tx.cashSession.findFirst({ where: { tenantId: ctx.tenant.id, closedAt: null } });
    if (aberto) return false;
    await tx.cashSession.create({ data: { tenantId: ctx.tenant.id, openingCents: opening, openedById: ctx.user.id } });
    return true;
  }, { isolationLevel: "Serializable" });
  if (!r) return fail("Já existe um caixa aberto.");
  revalidate();
  return success("Caixa aberto.");
}

export async function cashMovementAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await frontDesk();
  const kind = formData.get("kind");
  if (kind !== "SUPPLY" && kind !== "WITHDRAWAL") return fail("Escolha suprimento ou sangria.");
  const amount = money(String(formData.get("amount") ?? ""));
  if (amount == null) return fail("Valor inválido. Use o formato 50,00.");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  const caixa = await caixaAbertoDe(ctx.tenant.id);
  if (!caixa) return fail("Abra o caixa antes de lançar movimentações.");
  if (kind === "WITHDRAWAL") {
    const { esperadoCents } = await situacaoDoCaixa(caixa);
    if (amount > esperadoCents) return fail(`A gaveta deveria ter só ${(esperadoCents / 100).toFixed(2).replace(".", ",")}. Confira o valor da sangria.`);
  }
  await db.cashMovement.create({ data: { tenantId: ctx.tenant.id, sessionId: caixa.id, kind, amountCents: amount, note, createdById: ctx.user.id } });
  revalidate();
  return success(kind === "SUPPLY" ? "Suprimento lançado." : "Sangria lançada.");
}

export async function closeCashAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await frontDesk();
  const counted = money(String(formData.get("counted") ?? ""), { allowZero: true });
  if (counted == null) return fail("Informe quanto dinheiro há na gaveta (ex.: 350,00).");
  const caixa = await caixaAbertoDe(ctx.tenant.id);
  if (!caixa) return fail("Não há caixa aberto.");
  const closedAt = new Date();
  const { esperadoCents } = await situacaoDoCaixa({ ...caixa, closedAt });
  await db.cashSession.update({
    where: { id: caixa.id },
    data: { closedAt, expectedCents: esperadoCents, countedCents: counted, closedById: ctx.user.id, note: String(formData.get("note") ?? "").trim().slice(0, 300) || null },
  });
  revalidate();
  const dif = diferencaDoCaixa(counted, esperadoCents);
  return success(dif === 0 ? "Caixa fechado: confere." : dif > 0 ? "Caixa fechado com sobra." : "Caixa fechado com falta.");
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { parseMoneyToCents } from "@/lib/money";
import { saldoDoCliente } from "@/lib/loyalty/db";
import { validarPercentual, validarUso } from "@/lib/loyalty/rules";

const MAX_CENTS = 1_000_000 * 100;
const revalidateClient = (id: string) => { revalidatePath(`/app/clientes/${id}`); revalidatePath("/app/configuracoes/fidelidade"); };

/** Liga/desliga a fidelidade e define o percentual. Só dono e gerente. */
export async function setCashbackPercentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.canManage) return fail("Apenas a responsável pode alterar a fidelidade.");
  const v = validarPercentual(Number(String(formData.get("percent") ?? "").trim() || 0));
  if (!v.ok) return fail(v.error);
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { cashbackPercent: v.percent } });
  revalidatePath("/app/configuracoes/fidelidade");
  return success(v.percent === 0 ? "Fidelidade desligada. Os saldos que as clientes já têm continuam valendo." : `Fidelidade ligada: ${v.percent}% de cashback nos serviços concluídos.`);
}

/** A cliente usa parte do saldo (desconto dado no pagamento). Dono, gerente e recepção. */
export async function redeemCashbackAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.seesTeam) return fail("Sem permissão para registrar o uso do cashback.");
  const client = await db.client.findFirst({ where: { id: clientId, tenantId: ctx.tenant.id }, select: { id: true } });
  if (!client) return fail("Cliente não encontrada");
  const cents = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  // Serializable: dois usos simultâneos não podem gastar o mesmo saldo duas vezes.
  const result = await db.$transaction(async (tx) => {
    const agg = await tx.cashbackEntry.aggregate({ where: { tenantId: ctx.tenant.id, clientId }, _sum: { amountCents: true } });
    const uso = validarUso(cents != null && cents <= MAX_CENTS ? cents : null, agg._sum.amountCents ?? 0);
    if (!uso.ok) return uso;
    await tx.cashbackEntry.create({ data: { tenantId: ctx.tenant.id, clientId, kind: "REDEEM", amountCents: -uso.valorCents, note, createdById: ctx.user.id } });
    return uso;
  }, { isolationLevel: "Serializable" });
  if (!result.ok) return fail(result.error);
  revalidateClient(clientId);
  return success("Uso do cashback registrado.");
}

/** Bônus ou correção manual do saldo. Só dono e gerente; exige motivo. */
export async function adjustCashbackAction(clientId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.canManage) return fail("Apenas a responsável pode ajustar o saldo.");
  const client = await db.client.findFirst({ where: { id: clientId, tenantId: ctx.tenant.id }, select: { id: true } });
  if (!client) return fail("Cliente não encontrada");
  const cents = parseMoneyToCents(String(formData.get("amount") ?? ""));
  if (cents == null || cents <= 0 || cents > MAX_CENTS) return fail("Informe um valor maior que zero.");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  if (note.length < 3) return fail("Explique o motivo do ajuste.");
  const sinal = formData.get("sign") === "debit" ? -1 : 1;
  if (sinal < 0 && cents > (await saldoDoCliente(ctx.tenant.id, clientId))) return fail("O ajuste não pode deixar o saldo negativo.");
  await db.cashbackEntry.create({ data: { tenantId: ctx.tenant.id, clientId, kind: "ADJUST", amountCents: sinal * cents, note, createdById: ctx.user.id } });
  revalidateClient(clientId);
  return success("Saldo ajustado.");
}

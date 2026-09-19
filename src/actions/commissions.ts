"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";

/**
 * Marca como pagas as comissões pendentes de um profissional em um intervalo (SPEC §17: valores pagos/pendentes).
 * Só visitas concluídas contam; o intervalo é pelo início do item, no fuso do salão (as datas vêm da página).
 */
export async function markCommissionsPaidAction(professionalId: string, fromIso: string, toIso: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.canManage) return fail("Apenas o responsável pode acertar comissões.");
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return fail("Período inválido");
  const pro = await db.professional.findFirst({ where: { id: professionalId, tenantId: ctx.tenant.id }, select: { id: true } });
  if (!pro) return fail("Profissional não encontrado");

  const res = await db.appointmentItem.updateMany({
    where: {
      professionalId, tenantId: ctx.tenant.id,
      commissionCents: { not: null }, commissionPaidAt: null,
      appointment: { status: "COMPLETED" },
      startsAt: { gte: from, lt: to },
    },
    data: { commissionPaidAt: new Date() },
  });
  revalidatePath("/app/comissoes");
  return success(res.count ? `${res.count} ${res.count === 1 ? "comissão acertada" : "comissões acertadas"}.` : "Nada pendente neste período.");
}

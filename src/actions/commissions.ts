"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { parseCommissionField } from "@/lib/commissions";

/**
 * Salva a tabela de comissões padrão (uma por serviço, vale para todos). Campos: "commission_<serviceId>" e
 * "commissionKind_<serviceId>" (pct | brl); vazio = serviço sem comissão padrão. Só vale para visitas concluídas
 * daqui para frente: o que já foi apurado fica como está. Mexer em comissões é de quem gerencia a equipe.
 */
export async function saveCommissionTableAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.can("equipe")) return fail("Apenas quem gerencia a equipe altera a tabela de comissões.");
  const services = await db.service.findMany({ where: { tenantId: ctx.tenant.id, deletedAt: null, isAddOn: false }, select: { id: true, name: true } });
  const updates = [];
  for (const s of services) {
    const terms = parseCommissionField(String(formData.get(`commissionKind_${s.id}`) ?? "pct"), String(formData.get(`commission_${s.id}`) ?? ""));
    if (!terms) return fail(`Comissão inválida em ${s.name}: use um percentual de 0 a 100 ou um valor em reais.`);
    updates.push(db.service.update({ where: { id: s.id }, data: { commissionPercent: terms.percent ?? null, commissionFixedCents: terms.fixedCents ?? null } }));
  }
  await db.$transaction(updates);
  revalidatePath("/app/comissoes", "layout");
  revalidatePath("/app/equipe", "layout");
  return success("Tabela de comissões salva!");
}

/**
 * Marca como pagas as comissões pendentes de um profissional em um intervalo (SPEC §17: valores pagos/pendentes).
 * Só visitas concluídas contam; o intervalo é pelo início do item, no fuso do salão (as datas vêm da página).
 */
export async function markCommissionsPaidAction(professionalId: string, fromIso: string, toIso: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.can("comissoes_acertar")) return fail("Apenas o responsável pode acertar comissões.");
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

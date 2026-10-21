"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { todayKey } from "@/lib/dates";
import { periodoDaCampanha, validarDiasReativacao, type CampaignKind } from "@/lib/campaigns/rules";

const revalidate = () => revalidatePath("/app/campanhas");

/** Registra que a mensagem da campanha foi enviada à cliente neste período (aniversário: o ano; reativação: o mês). */
export async function markCampaignSentAction(clientId: string, kind: CampaignKind, dia: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.seesTeam) return fail("Sem permissão para registrar envios.");
  if (kind !== "BIRTHDAY" && kind !== "REACTIVATION") return fail("Campanha inválida");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return fail("Data inválida");
  const client = await db.client.findFirst({ where: { id: clientId, tenantId: ctx.tenant.id }, select: { id: true } });
  if (!client) return fail("Cliente não encontrada");
  // Ignora a repetição: o índice único garante um envio por cliente, campanha e período.
  await db.campaignSend.createMany({
    data: [{ tenantId: ctx.tenant.id, clientId, kind, periodKey: periodoDaCampanha(kind, kind === "REACTIVATION" ? todayKey(ctx.tenant.timezone) : dia), createdById: ctx.user.id }],
    skipDuplicates: true,
  });
  revalidate();
  return success("Envio registrado.");
}

export async function desfazerEnvioAction(clientId: string, kind: CampaignKind, dia: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.seesTeam) return fail("Sem permissão.");
  if (kind !== "BIRTHDAY" && kind !== "REACTIVATION") return fail("Campanha inválida");
  await db.campaignSend.deleteMany({
    where: { tenantId: ctx.tenant.id, clientId, kind, periodKey: periodoDaCampanha(kind, kind === "REACTIVATION" ? todayKey(ctx.tenant.timezone) : dia) },
  });
  revalidate();
  return success();
}

/** Textos das mensagens (com {nome} e {estabelecimento}) e a regra de reativação. Só dono e gerente. */
export async function saveCampaignSettingsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.canManage) return fail("Apenas a responsável pode alterar as campanhas.");
  const birthday = String(formData.get("birthdayMessage") ?? "").trim();
  const reactivation = String(formData.get("reactivationMessage") ?? "").trim();
  const dias = Number(String(formData.get("reactivationDays") ?? "").trim());
  if (birthday.length > 600 || reactivation.length > 600) return fail("A mensagem pode ter no máximo 600 caracteres.");
  if (!validarDiasReativacao(dias)) return fail("Use de 15 a 365 dias para a reativação.");
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { birthdayMessage: birthday || null, reactivationMessage: reactivation || null, reactivationDays: dias } });
  revalidate();
  return success("Campanhas salvas!");
}

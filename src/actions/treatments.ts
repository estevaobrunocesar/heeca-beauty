"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, type AuthContext } from "@/lib/auth/session";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { parseMoneyToCents } from "@/lib/money";
import { zonedDateTimeToUtc } from "@/lib/dates";
import { moduloClinicoAtivo } from "@/lib/treatments/rules";

/**
 * Módulo clínico (opção do segmento Estética): protocolos, avaliações, recebimentos do plano e evolução por sessão.
 * Protocolos e recebimentos são de gestão (dono/gerente); avaliações e evolução também do profissional que atende;
 * a recepção não vê dado clínico.
 */

async function clinical(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.role === "RECEPTION") throw new Error("A recepção não tem acesso aos dados clínicos.");
  if (!moduloClinicoAtivo(ctx.tenant.segmentos)) throw new Error("O módulo clínico é do segmento Estética. Ative em Configurações → Segmentos.");
  return ctx;
}
async function manager(): Promise<AuthContext> {
  const ctx = await clinical();
  if (!ctx.canManage) throw new Error("Apenas dono e gerente.");
  return ctx;
}
/** Server action nunca deve estourar 500 por permissão: devolve a mensagem. */
const guard = async <T>(fn: () => Promise<T>): Promise<T | ActionResult> => {
  try { return await fn(); } catch (e) { if (e && typeof e === "object" && "digest" in e) throw e; return fail(e instanceof Error ? e.message : "Erro inesperado."); }
};

const revalidate = () => { for (const p of ["/app/protocolos", "/app/avaliacoes", "/app/pacotes", "/app/clientes"]) revalidatePath(p); };

// ───────── Protocolos ─────────

const protocolSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do protocolo").max(80),
  objective: z.string().trim().max(200).optional().or(z.literal("")),
  sessionsCount: z.coerce.number().int().min(1, "Ao menos 1 sessão").max(200),
  intervalDays: z.coerce.number().int().min(0).max(365).optional(),
  products: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function saveProtocolAction(id: string | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await manager();
    const p = protocolSchema.safeParse(Object.fromEntries(formData));
    if (!p.success) return fail(p.error.issues[0].message);
    // Etapas: campos paralelos stepServiceId[] / stepNotes[]; ordem = ordem do formulário.
    const serviceIds = formData.getAll("stepServiceId").map(String);
    const notes = formData.getAll("stepNotes").map(String);
    if (serviceIds.length === 0) return fail("Adicione ao menos uma etapa (um serviço do catálogo).");
    const valid = await db.service.findMany({ where: { id: { in: serviceIds }, tenantId: ctx.tenant.id, isAddOn: false, deletedAt: null }, select: { id: true } });
    const ok = new Set(valid.map((s) => s.id));
    if (serviceIds.some((s) => !ok.has(s))) return fail("Uma das etapas usa um serviço que não existe mais.");
    const steps = serviceIds.map((serviceId, i) => ({ serviceId, order: i + 1, notes: notes[i]?.trim().slice(0, 300) || null }));
    const data = {
      name: p.data.name, objective: p.data.objective || null, sessionsCount: p.data.sessionsCount,
      intervalDays: p.data.intervalDays || null, products: p.data.products || null, notes: p.data.notes || null,
      active: formData.get("active") === "on",
    };
    if (id) {
      const own = await db.protocol.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { id: true } });
      if (!own) return fail("Protocolo não encontrado");
      await db.$transaction([
        db.protocol.update({ where: { id }, data }),
        db.protocolStep.deleteMany({ where: { protocolId: id } }),
        db.protocolStep.createMany({ data: steps.map((s) => ({ ...s, protocolId: id })) }),
      ]);
    } else {
      const last = await db.protocol.findFirst({ where: { tenantId: ctx.tenant.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      await db.protocol.create({ data: { ...data, tenantId: ctx.tenant.id, sortOrder: (last?.sortOrder ?? 0) + 1, steps: { create: steps } } });
    }
    revalidate();
    return success(id ? "Protocolo atualizado!" : "Protocolo criado!");
  }) as Promise<ActionResult>;
}

export async function toggleProtocolAction(id: string) {
  const ctx = await manager();
  const p = await db.protocol.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { active: true } });
  if (!p) return;
  await db.protocol.update({ where: { id }, data: { active: !p.active } });
  revalidate();
}

/** Excluir só sem uso: um pacote cujo protocolo some viraria "vale tudo". Em uso → desativar. */
export async function deleteProtocolAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await manager();
    const [pacotes, planos] = await Promise.all([
      db.package.count({ where: { protocolId: id, tenantId: ctx.tenant.id } }),
      db.clientPackage.count({ where: { protocolId: id, tenantId: ctx.tenant.id } }),
    ]);
    if (pacotes + planos > 0) return fail(`Este protocolo está em uso (${pacotes} pacote(s) no catálogo, ${planos} plano(s) vendido(s)). Desative em vez de excluir.`);
    await db.protocol.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
    revalidate();
    return success("Protocolo excluído.");
  }) as Promise<ActionResult>;
}

// ───────── Avaliações ─────────

const assessmentSchema = z.object({
  clientId: z.string().min(1, "Escolha o cliente"),
  professionalId: z.string().min(1, "Escolha o profissional"),
  performedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  complaints: z.string().trim().max(600).optional().or(z.literal("")),
  analysis: z.string().trim().max(1000).optional().or(z.literal("")),
  notes: z.string().trim().max(600).optional().or(z.literal("")),
  recommendedProtocolId: z.string().optional().or(z.literal("")),
  suggestedSessions: z.coerce.number().int().min(1).max(200).optional(),
});

export async function saveAssessmentAction(id: string | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  const res = await guard(async () => {
    const ctx = await clinical();
    const p = assessmentSchema.safeParse(Object.fromEntries(formData));
    if (!p.success) return fail(p.error.issues[0].message);
    const d = p.data;
    // Sem perfil de gestão, só em nome do próprio profissional.
    if (!ctx.canManage && d.professionalId !== ctx.user.professional?.id) return fail("Você só registra avaliações em seu nome.");
    const serviceIds = [...new Set(formData.getAll("serviceId").map(String))];
    const [client, pro, protocol, services, existing] = await Promise.all([
      db.client.findFirst({ where: { id: d.clientId, tenantId: ctx.tenant.id }, select: { id: true } }),
      db.professional.findFirst({ where: { id: d.professionalId, tenantId: ctx.tenant.id }, select: { id: true } }),
      d.recommendedProtocolId ? db.protocol.findFirst({ where: { id: d.recommendedProtocolId, tenantId: ctx.tenant.id }, select: { id: true } }) : null,
      serviceIds.length ? db.service.findMany({ where: { id: { in: serviceIds }, tenantId: ctx.tenant.id, isAddOn: false, deletedAt: null }, select: { id: true } }) : [],
      id ? db.assessment.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { id: true, professionalId: true } }) : null,
    ]);
    if (!client) return fail("Cliente não encontrado");
    if (!pro) return fail("Profissional não encontrado");
    if (d.recommendedProtocolId && !protocol) return fail("Protocolo não encontrado");
    if (id && !existing) return fail("Avaliação não encontrada");
    if (id && !ctx.canManage && existing!.professionalId !== ctx.user.professional?.id) return fail("Esta avaliação é de outro profissional.");
    const data = {
      clientId: client.id, professionalId: pro.id,
      performedAt: zonedDateTimeToUtc(d.performedAt, 12 * 60, ctx.tenant.timezone),
      complaints: d.complaints || null, analysis: d.analysis || null, notes: d.notes || null,
      recommendedProtocolId: protocol?.id ?? null, suggestedSessions: d.suggestedSessions ?? null,
    };
    const links = services.map((s) => ({ serviceId: s.id }));
    if (id) {
      await db.$transaction([
        db.assessment.update({ where: { id }, data }),
        db.assessmentService.deleteMany({ where: { assessmentId: id } }),
        db.assessmentService.createMany({ data: links.map((l) => ({ assessmentId: id, ...l })) }),
      ]);
      createdId = id;
    } else {
      createdId = (await db.assessment.create({ data: { ...data, tenantId: ctx.tenant.id, recommendedServices: { create: links } } })).id;
    }
    revalidate();
    return success(id ? "Avaliação atualizada!" : "Avaliação registrada!");
  }) as ActionResult;
  if (res?.ok && createdId && !id) redirect(`/app/avaliacoes/${createdId}`);
  return res;
}

export async function deleteAssessmentAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await clinical();
    const a = await db.assessment.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { professionalId: true } });
    if (!a) return fail("Avaliação não encontrada");
    if (!ctx.canManage && a.professionalId !== ctx.user.professional?.id) return fail("Esta avaliação é de outro profissional.");
    await db.assessment.delete({ where: { id } }); // o plano nascido dela fica (assessmentId vira null)
    revalidate();
    return success("Avaliação excluída.");
  }) as Promise<ActionResult>;
}

// ───────── Recebimentos do plano ─────────

const paymentSchema = z.object({
  amount: z.string().trim().min(1, "Informe o valor"),
  method: z.enum(["PIX", "CASH", "CREDIT", "DEBIT", "TRANSFER"]),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  notes: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function addPlanPaymentAction(clientPackageId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await manager();
    const p = paymentSchema.safeParse(Object.fromEntries(formData));
    if (!p.success) return fail(p.error.issues[0].message);
    const amountCents = parseMoneyToCents(p.data.amount);
    if (amountCents == null || amountCents <= 0) return fail("Valor inválido");
    const plan = await db.clientPackage.findFirst({ where: { id: clientPackageId, tenantId: ctx.tenant.id }, select: { id: true } });
    if (!plan) return fail("Plano não encontrado");
    await db.clientPackagePayment.create({
      data: { tenantId: ctx.tenant.id, clientPackageId: plan.id, amountCents, method: p.data.method, paidAt: zonedDateTimeToUtc(p.data.paidAt, 12 * 60, ctx.tenant.timezone), notes: p.data.notes || null },
    });
    revalidatePath(`/app/pacotes/${plan.id}`);
    return success("Recebimento registrado!");
  }) as Promise<ActionResult>;
}

export async function removePlanPaymentAction(paymentId: string) {
  const ctx = await manager();
  const pay = await db.clientPackagePayment.findFirst({ where: { id: paymentId, tenantId: ctx.tenant.id }, select: { clientPackageId: true } });
  if (!pay) return;
  await db.clientPackagePayment.delete({ where: { id: paymentId } });
  revalidatePath(`/app/pacotes/${pay.clientPackageId}`);
}

// ───────── Evolução por sessão ─────────

const evolutionSchema = z.object({
  productsUsed: z.string().trim().max(300).optional().or(z.literal("")),
  evolution: z.string().trim().max(1500).optional().or(z.literal("")),
});

/** Anotação clínica da sessão: dono/gerente, ou o profissional que realizou o atendimento. */
export async function saveSessionEvolutionAction(sessionId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await clinical();
    const e = evolutionSchema.safeParse(Object.fromEntries(formData));
    if (!e.success) return fail(e.error.issues[0].message);
    const s = await db.packageSession.findFirst({ where: { id: sessionId, tenantId: ctx.tenant.id }, select: { clientPackageId: true, item: { select: { professionalId: true } } } });
    if (!s) return fail("Sessão não encontrada");
    if (!ctx.canManage && s.item?.professionalId !== ctx.user.professional?.id) return fail("Só o profissional que atendeu (ou a gestão) anota a evolução.");
    await db.packageSession.update({ where: { id: sessionId }, data: { productsUsed: e.data.productsUsed || null, evolution: e.data.evolution || null } });
    revalidatePath(`/app/pacotes/${s.clientPackageId}`);
    return success("Evolução salva");
  }) as Promise<ActionResult>;
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { parseClientPhone } from "@/lib/phone";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { perfilDoTenant } from "@/lib/marca-atual";
import { fichaDoForm } from "@/lib/clients/ficha";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  phone: z.string().trim().optional().or(z.literal("")), // obrigatório ou não conforme Tenant.requirePhone
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  // Ficha técnica: os campos `ficha.<codigo>` são lidos à parte (fichaDoForm, por segmento)
  allergies: z.string().trim().max(300).optional().or(z.literal("")),
  maintenanceIntervalDays: z.coerce.number().int().min(0).max(365).optional(),
});

export async function updateClientAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { tenant } = await requireAuth();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const parsedPhone = parseClientPhone(d.phone, tenant.requirePhone);
  if (!parsedPhone.ok) return fail(parsedPhone.error);
  const phone = parsedPhone.phone;

  if (phone) {
    const clash = await db.client.findFirst({ where: { tenantId: tenant.id, phone, NOT: { id } } });
    if (clash) return fail("Já existe outra cliente com este WhatsApp.");
  }

  // Profissionais de preferência: zero ou mais, só deste estabelecimento. Já preferidas que foram desativadas continuam válidas.
  const pedidas = [...new Set(formData.getAll("preferredProfessionalIds").map(String).filter(Boolean))];
  const validas = pedidas.length
    ? await db.professional.findMany({ where: { id: { in: pedidas }, tenantId: tenant.id }, select: { id: true, active: true } })
    : [];
  if (validas.length !== pedidas.length) return fail("Profissional inválida");
  const atuais = new Set((await db.clientProfessional.findMany({ where: { clientId: id }, select: { professionalId: true } })).map((r) => r.professionalId));
  if (validas.some((p) => !p.active && !atuais.has(p.id))) return fail("Profissional inválida");

  const dono = await db.client.findFirst({ where: { id, tenantId: tenant.id }, select: { id: true } });
  if (!dono) return fail("Cliente não encontrada");
  const res = await db.client.updateMany({
    where: { id, tenantId: tenant.id },
    data: {
      name: d.name, phone, email: d.email || null, notes: d.notes || null,
      ficha: fichaDoForm(formData, perfilDoTenant(tenant).ficha), allergies: d.allergies || null,
      maintenanceIntervalDays: d.maintenanceIntervalDays || null,
    },
  });
  if (res.count === 0) return fail("Cliente não encontrada");
  await db.$transaction([
    db.clientProfessional.deleteMany({ where: { clientId: id } }),
    db.clientProfessional.createMany({ data: validas.map((p) => ({ clientId: id, professionalId: p.id })) }),
  ]);
  revalidatePath(`/app/clientes/${id}`);
  revalidatePath("/app/clientes");
  return success("Ficha atualizada");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { parseMoneyToCents } from "@/lib/money";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { ownedCategoryId } from "@/lib/services/categories-db";

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do procedimento").max(80),
  categoryId: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  clientNotes: z.string().trim().max(500).optional().or(z.literal("")),
  isAddOn: z.coerce.boolean().optional(),
  durationMinutes: z.coerce.number().int().min(5, "Duração mínima: 5 min").max(600),
  price: z.string().trim().min(1, "Informe o preço"),
  imageUrl: z.string().trim().url("URL da imagem inválida").optional().or(z.literal("")),
  active: z.coerce.boolean().optional(),
  // Sala e recursos (só com Tenant.salasAtivas): roomIds vazio = qualquer sala ativa; resources "id:qtd" por linha
  roomRequired: z.coerce.boolean().optional(),
  roomIds: z.array(z.string().min(1)).optional(),
  resources: z.array(z.object({ resourceId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(99) })).optional(),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(120).optional(),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(120).optional(),
});

function parse(formData: FormData) {
  const parsed = serviceSchema.safeParse({
    ...Object.fromEntries(formData),
    active: formData.get("active") === "on",
    isAddOn: formData.get("isAddOn") === "on",
    roomRequired: formData.get("roomRequired") === "on",
    roomIds: formData.getAll("roomIds").map(String),
    resources: formData.getAll("resourceIds").map(String).map((resourceId) => ({ resourceId, quantity: formData.get(`resourceQty.${resourceId}`) ?? 1 })),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const priceCents = parseMoneyToCents(parsed.data.price);
  if (priceCents == null) return { ok: false as const, error: "Preço inválido" };
  const { price: _price, roomIds, resources, ...rest } = parsed.data;
  void _price;
  return {
    ok: true as const,
    // Adicional nunca usa sala própria (acontece dentro do procedimento principal).
    data: { ...rest, categoryId: rest.categoryId || null, priceCents, isAddOn: rest.isAddOn ?? false, description: rest.description || null, clientNotes: rest.clientNotes || null, imageUrl: rest.imageUrl || null, roomRequired: !rest.isAddOn && (rest.roomRequired ?? false), bufferBeforeMinutes: rest.bufferBeforeMinutes ?? 0, bufferAfterMinutes: rest.bufferAfterMinutes ?? 0 },
    roomIds: roomIds ?? [],
    resources: resources ?? [],
  };
}

/** Salas/recursos do serviço: só os do próprio tenant (id forjado de outro salão é ignorado). */
async function ownedLinks(tenantId: string, roomIds: string[], resources: { resourceId: string; quantity: number }[]) {
  const [rooms, res] = await Promise.all([
    roomIds.length ? db.room.findMany({ where: { id: { in: roomIds }, tenantId }, select: { id: true } }) : [],
    resources.length ? db.resource.findMany({ where: { id: { in: resources.map((r) => r.resourceId) }, tenantId }, select: { id: true } }) : [],
  ]);
  const okRes = new Set(res.map((r) => r.id));
  return { rooms: rooms.map((r) => ({ roomId: r.id })), resources: resources.filter((r) => okRes.has(r.resourceId)).map((r) => ({ resourceId: r.resourceId, quantity: r.quantity })) };
}

export async function createServiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { tenant, canManage } = await requireAuth();
  if (!canManage) return fail("Apenas a responsável pode gerenciar os procedimentos.");
  const r = parse(formData);
  if (!r.ok) return fail(r.error);
  r.data.categoryId = await ownedCategoryId(tenant.id, r.data.categoryId);

  const [last, professionals] = await Promise.all([
    db.service.findFirst({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "desc" } }),
    db.professional.findMany({ where: { tenantId: tenant.id }, select: { id: true } }),
  ]);
  const links = await ownedLinks(tenant.id, r.roomIds, r.resources);
  await db.service.create({
    data: {
      ...r.data, active: r.data.active ?? true, tenantId: tenant.id, sortOrder: (last?.sortOrder ?? 0) + 1,
      // Serviço novo fica disponível para toda a equipe; restrinja na página de cada profissional.
      professionals: { create: professionals.map((p) => ({ professionalId: p.id })) },
      rooms: { create: links.rooms },
      resources: { create: links.resources },
    },
  });
  revalidatePath("/app/servicos");
  return success("Procedimento criado!");
}

export async function updateServiceAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { tenant, canManage } = await requireAuth();
  if (!canManage) return fail("Apenas a responsável pode gerenciar os procedimentos.");
  const r = parse(formData);
  if (!r.ok) return fail(r.error);
  r.data.categoryId = await ownedCategoryId(tenant.id, r.data.categoryId);

  // updateMany com tenantId: nunca atualiza serviço de outro tenant, mesmo com id forjado.
  const res = await db.service.updateMany({ where: { id, tenantId: tenant.id }, data: { ...r.data, active: r.data.active ?? false } });
  if (res.count === 0) return fail("Procedimento não encontrado");
  const links = await ownedLinks(tenant.id, r.roomIds, r.resources);
  await db.$transaction([
    db.serviceRoom.deleteMany({ where: { serviceId: id } }),
    db.serviceResource.deleteMany({ where: { serviceId: id } }),
    ...(links.rooms.length ? [db.serviceRoom.createMany({ data: links.rooms.map((x) => ({ serviceId: id, ...x })) })] : []),
    ...(links.resources.length ? [db.serviceResource.createMany({ data: links.resources.map((x) => ({ serviceId: id, ...x })) })] : []),
  ]);
  revalidatePath("/app/servicos");
  return success("Procedimento atualizado!");
}

export async function toggleServiceAction(id: string) {
  const { tenant, canManage } = await requireAuth();
  if (!canManage) return;
  const svc = await db.service.findFirst({ where: { id, tenantId: tenant.id } });
  if (!svc) return;
  await db.service.update({ where: { id }, data: { active: !svc.active } });
  revalidatePath("/app/servicos");
}

export async function deleteServiceAction(id: string) {
  const { tenant, canManage } = await requireAuth();
  if (!canManage) return;
  // Soft delete: agendamentos passados continuam apontando para o serviço.
  await db.service.updateMany({ where: { id, tenantId: tenant.id }, data: { deletedAt: new Date(), active: false } });
  revalidatePath("/app/servicos");
}

export async function moveServiceAction(id: string, direction: "up" | "down") {
  const { tenant, canManage } = await requireAuth();
  if (!canManage) return;
  const list = await db.service.findMany({ where: { tenantId: tenant.id, deletedAt: null }, orderBy: { sortOrder: "asc" } });
  const idx = list.findIndex((s) => s.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= list.length) return;
  [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
  // Reindexa toda a lista: evita empates de sortOrder herdados de cadastros antigos.
  await db.$transaction(list.map((s, i) => db.service.update({ where: { id: s.id }, data: { sortOrder: i } })));
  revalidatePath("/app/servicos");
}

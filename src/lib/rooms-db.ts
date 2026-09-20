import "server-only";
import { db } from "@/lib/db";
import type { RoomOptions } from "@/app/(dashboard)/app/servicos/service-form";

/** Salas e recursos ativos para os formulários — null quando a opção "agenda por sala" está desligada. */
export async function roomOptionsFor(tenant: { id: string; salasAtivas: boolean }): Promise<RoomOptions> {
  if (!tenant.salasAtivas) return null;
  const [rooms, resources] = await Promise.all([
    db.room.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.resource.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, quantity: true } }),
  ]);
  return { rooms, resources };
}

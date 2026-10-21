import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { formatPhone } from "@/lib/phone";
import { UnitsManager } from "./units-manager";

export default async function UnitsSettingsPage() {
  const { tenant } = await requireAuth();
  const units = await db.unit.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { professionals: true, rooms: true, appointments: true } } },
  });
  return (
    <div className="space-y-4">
      <UnitsManager units={units.map((u) => ({ id: u.id, name: u.name, address: u.address, phone: u.phone ? formatPhone(u.phone) : "", active: u.active, professionals: u._count.professionals, rooms: u._count.rooms, appointments: u._count.appointments }))} />
      <p className="text-xs text-mut">Depois de criar as unidades, indique a unidade de cada profissional (em Equipe) e de cada sala (em Salas). Quem não tem unidade atende em todas.</p>
    </div>
  );
}

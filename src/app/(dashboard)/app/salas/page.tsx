import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { fmtDateTime } from "@/lib/dates";
import { RoomsManager } from "./rooms-manager";
import { ResourcesManager } from "./resources-manager";
import { BlocksManager } from "./blocks-manager";

/**
 * Salas e recursos (opção "agenda por sala" — Tenant.salasAtivas). O motor de horários só vende um
 * horário quando profissional + sala + recursos estão livres; aqui o estabelecimento cadastra o que tem.
 */
export default async function SalasPage() {
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const { tenant } = ctx;
  if (!tenant.salasAtivas) redirect("/app/configuracoes/segmentos");

  const [rooms, resources, blocks] = await Promise.all([
    db.room.findMany({ where: { tenantId: tenant.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { services: true } } } }),
    db.resource.findMany({ where: { tenantId: tenant.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { services: true } } } }),
    db.scheduleBlock.findMany({
      where: { tenantId: tenant.id, endsAt: { gte: new Date() }, OR: [{ roomId: { not: null } }, { resourceId: { not: null } }] },
      orderBy: { startsAt: "asc" }, take: 50,
      include: { room: { select: { name: true } }, resource: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Salas e recursos"
        description="Um horário só é oferecido quando o profissional, a sala e os recursos do serviço estão livres. Diga no cadastro de cada serviço se ele precisa de sala e quais recursos consome."
        actions={<Link href="/app/agenda?view=rooms" className="btn-secondary">Agenda por sala</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <RoomsManager rooms={rooms.map((r) => ({ id: r.id, name: r.name, kind: r.kind, capacity: r.capacity, description: r.description, active: r.active, services: r._count.services }))} />
        <ResourcesManager resources={resources.map((r) => ({ id: r.id, name: r.name, quantity: r.quantity, description: r.description, active: r.active, services: r._count.services }))} />
      </div>
      <div className="mt-6">
        <BlocksManager
          targets={[...rooms.filter((r) => r.active).map((r) => ({ value: `room:${r.id}`, label: `Sala · ${r.name}` })), ...resources.filter((r) => r.active).map((r) => ({ value: `resource:${r.id}`, label: `Recurso · ${r.name}` }))]}
          blocks={blocks.map((b) => ({ id: b.id, alvo: b.room ? `Sala · ${b.room.name}` : `Recurso · ${b.resource?.name ?? ""}`, periodo: `${fmtDateTime(b.startsAt, tenant.timezone)} → ${fmtDateTime(b.endsAt, tenant.timezone)}`, reason: b.reason }))}
        />
      </div>
    </>
  );
}

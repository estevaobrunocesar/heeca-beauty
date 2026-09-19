import { db } from "@/lib/db";
import { requireAuth, activeProfessionals } from "@/lib/auth/session";
import { todayKey } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { ManualAppointmentForm } from "./manual-form";

export default async function NewAppointmentPage({ searchParams }: PageProps<"/app/agenda/novo">) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const { tenant } = ctx;
  const [services, clients] = await Promise.all([
    db.service.findMany({
      where: { tenantId: tenant.id, active: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: { professionals: { select: { professionalId: true } } },
    }),
    db.client.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" }, select: { name: true, phone: true } }),
  ]);
  const preselected = typeof sp.cliente === "string" ? clients.find((c) => c.phone === sp.cliente) ?? null : null;
  const team = activeProfessionals(ctx);
  const defaultPro = (typeof sp.pro === "string" && team.find((p) => p.id === sp.pro)?.id) || ctx.professional.id;

  return (
    <>
      <PageHeader title="Novo agendamento" description="Agendamentos criados aqui nascem confirmados e a cliente recebe a confirmação por WhatsApp." />
      <ManualAppointmentForm
        slug={tenant.slug}
        todayKey={todayKey(tenant.timezone)}
        maxAdvanceDays={tenant.maxAdvanceDays}
        professionals={team.map((p) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl }))}
        defaultProfessionalId={defaultPro}
        services={services.filter((s) => !s.isAddOn).map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes, priceCents: s.priceCents, professionalIds: s.professionals.map((p) => p.professionalId) }))}
        addOns={services.filter((s) => s.isAddOn).map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes, priceCents: s.priceCents }))}
        clients={clients}
        preselected={preselected}
      />
    </>
  );
}

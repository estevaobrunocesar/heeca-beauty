import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigirClinico } from "@/lib/treatments/access";
import { PageHeader } from "@/components/ui/page-header";
import { ProtocolForm } from "../protocol-form";

export default async function EditarProtocoloPage({ params }: PageProps<"/app/protocolos/[id]">) {
  const { id } = await params;
  const ctx = await exigirClinico({ gestao: true });
  const [protocol, services] = await Promise.all([
    db.protocol.findFirst({ where: { id, tenantId: ctx.tenant.id }, include: { steps: { orderBy: { order: "asc" }, select: { serviceId: true, notes: true } } } }),
    // Serviço já usado numa etapa continua na lista mesmo se foi desativado depois (senão a etapa "sumiria" ao editar).
    db.service.findMany({ where: { tenantId: ctx.tenant.id, deletedAt: null, isAddOn: false }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, durationMinutes: true, active: true } }),
  ]);
  if (!protocol) notFound();
  const usados = new Set(protocol.steps.map((s) => s.serviceId));
  return (
    <>
      <PageHeader title={protocol.name} description="Planos já vendidos mantêm sessões, validade e preço contratados; as etapas valem para todos — o que cabe num plano em andamento segue o protocolo atual." />
      <ProtocolForm initial={protocol} services={services.filter((s) => s.active || usados.has(s.id))} />
    </>
  );
}

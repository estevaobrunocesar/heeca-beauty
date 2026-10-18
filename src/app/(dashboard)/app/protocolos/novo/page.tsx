import { db } from "@/lib/db";
import { exigirClinico } from "@/lib/treatments/access";
import { PageHeader } from "@/components/ui/page-header";
import { ProtocolForm } from "../protocol-form";

export default async function NovoProtocoloPage() {
  const ctx = await exigirClinico({ gestao: true });
  const services = await db.service.findMany({ where: { tenantId: ctx.tenant.id, active: true, deletedAt: null, isAddOn: false }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, durationMinutes: true } });
  return (
    <>
      <PageHeader title="Novo protocolo" />
      <ProtocolForm services={services} />
    </>
  );
}

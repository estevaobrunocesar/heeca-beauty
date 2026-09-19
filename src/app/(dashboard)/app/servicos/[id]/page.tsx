import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { ServiceForm } from "../service-form";

export default async function EditServicePage({ params }: PageProps<"/app/servicos/[id]">) {
  const { id } = await params;
  const { tenant } = await requireAuth();
  const service = await db.service.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } });
  if (!service) notFound();

  return (
    <>
      <PageHeader title={service.isAddOn ? "Editar adicional" : "Editar procedimento"} />
      <ServiceForm initial={service} />
    </>
  );
}

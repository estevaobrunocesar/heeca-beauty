import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/categories-db";
import { PageHeader } from "@/components/ui/page-header";
import { ServiceForm } from "../service-form";

export default async function EditServicePage({ params }: PageProps<"/app/servicos/[id]">) {
  const { id } = await params;
  const { tenant } = await requireAuth();
  const [service, categories] = await Promise.all([
    db.service.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } }),
    listCategories(tenant.id),
  ]);
  if (!service) notFound();

  return (
    <>
      <PageHeader title={service.isAddOn ? "Editar adicional" : "Editar serviço"} />
      <ServiceForm initial={service} categories={categories} />
    </>
  );
}

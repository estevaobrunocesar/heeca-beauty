import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/categories-db";
import { PageHeader } from "@/components/ui/page-header";
import { ServiceForm } from "../service-form";
import { roomOptionsFor } from "@/lib/rooms-db";
import { ServiceProducts } from "./service-products";

export default async function EditServicePage({ params }: PageProps<"/app/servicos/[id]">) {
  const { id } = await params;
  const { tenant, canManage } = await requireAuth();
  const [service, categories, roomOptions, produtos, receita] = await Promise.all([
    db.service.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null }, include: { rooms: { select: { roomId: true } }, resources: { select: { resourceId: true, quantity: true } } } }),
    listCategories(tenant.id),
    roomOptionsFor(tenant),
    canManage ? db.product.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }) : Promise.resolve([]),
    db.serviceProduct.findMany({ where: { serviceId: id, tenantId: tenant.id }, select: { productId: true, quantity: true } }),
  ]);
  if (!service) notFound();

  return (
    <>
      <PageHeader title={service.isAddOn ? "Editar adicional" : "Editar serviço"} />
      <ServiceForm initial={{ ...service, roomIds: service.rooms.map((r) => r.roomId) }} categories={categories} roomOptions={roomOptions} />
      {canManage && <ServiceProducts serviceId={service.id} options={produtos} initial={receita} />}
    </>
  );
}

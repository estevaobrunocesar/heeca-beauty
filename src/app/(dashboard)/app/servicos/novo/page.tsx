import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/categories-db";
import { PageHeader } from "@/components/ui/page-header";
import { ServiceForm } from "../service-form";
import { roomOptionsFor } from "@/lib/rooms-db";

export default async function NewServicePage({ searchParams }: PageProps<"/app/servicos/novo">) {
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const sp = await searchParams;
  const addOn = sp.tipo === "adicional";
  const [categories, roomOptions] = await Promise.all([listCategories(ctx.tenant.id), roomOptionsFor(ctx.tenant)]);
  return (
    <>
      <PageHeader title={addOn ? "Novo adicional" : "Novo serviço"} />
      <ServiceForm defaultAddOn={addOn} categories={categories} roomOptions={roomOptions} />
    </>
  );
}

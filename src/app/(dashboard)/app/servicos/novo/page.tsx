import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/categories-db";
import { PageHeader } from "@/components/ui/page-header";
import { ServiceForm } from "../service-form";

export default async function NewServicePage({ searchParams }: PageProps<"/app/servicos/novo">) {
  const ctx = await requireAuth();
  if (!ctx.isOwner) redirect("/app");
  const sp = await searchParams;
  const addOn = sp.tipo === "adicional";
  const categories = await listCategories(ctx.tenant.id);
  return (
    <>
      <PageHeader title={addOn ? "Novo adicional" : "Novo serviço"} />
      <ServiceForm defaultAddOn={addOn} categories={categories} />
    </>
  );
}

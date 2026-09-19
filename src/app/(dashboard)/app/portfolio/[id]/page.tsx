import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/categories-db";
import { PageHeader } from "@/components/ui/page-header";
import { PortfolioItemForm } from "../item-form";

export default async function EditPortfolioItemPage({ params }: PageProps<"/app/portfolio/[id]">) {
  const { id } = await params;
  const { tenant } = await requireAuth();
  const [item, categories] = await Promise.all([
    db.portfolioItem.findFirst({ where: { id, tenantId: tenant.id } }),
    listCategories(tenant.id),
  ]);
  if (!item) notFound();
  return (
    <>
      <PageHeader title="Editar foto" />
      <PortfolioItemForm initial={item} categories={categories} />
    </>
  );
}

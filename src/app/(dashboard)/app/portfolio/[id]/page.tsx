import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { PortfolioItemForm } from "../item-form";

export default async function EditPortfolioItemPage({ params }: PageProps<"/app/portfolio/[id]">) {
  const { id } = await params;
  const { tenant } = await requireAuth();
  const item = await db.portfolioItem.findFirst({ where: { id, tenantId: tenant.id } });
  if (!item) notFound();
  return (
    <>
      <PageHeader title="Editar foto" />
      <PortfolioItemForm initial={item} />
    </>
  );
}

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/categories-db";
import { PageHeader } from "@/components/ui/page-header";
import { PortfolioItemForm } from "../item-form";

export default async function NewPortfolioItemPage() {
  const ctx = await requireAuth();
  if (!ctx.isOwner) redirect("/app");
  const categories = await listCategories(ctx.tenant.id);
  return (
    <>
      <PageHeader title="Nova foto" />
      <PortfolioItemForm categories={categories} />
    </>
  );
}

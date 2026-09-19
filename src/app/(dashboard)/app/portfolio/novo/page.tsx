import { PageHeader } from "@/components/ui/page-header";
import { PortfolioItemForm } from "../item-form";

export default function NewPortfolioItemPage() {
  return (
    <>
      <PageHeader title="Nova foto" />
      <PortfolioItemForm />
    </>
  );
}

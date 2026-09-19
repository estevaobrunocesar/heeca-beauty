import { PageHeader } from "@/components/ui/page-header";
import { ServiceForm } from "../service-form";

export default async function NewServicePage({ searchParams }: PageProps<"/app/servicos/novo">) {
  const sp = await searchParams;
  const addOn = sp.tipo === "adicional";
  return (
    <>
      <PageHeader title={addOn ? "Novo adicional" : "Novo procedimento"} />
      <ServiceForm defaultAddOn={addOn} />
    </>
  );
}

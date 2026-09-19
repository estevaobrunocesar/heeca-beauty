import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { NewProfessionalForm } from "./new-form";

export default async function NewProfessionalPage() {
  const ctx = await requireAuth();
  if (!ctx.isOwner) redirect("/app/equipe");
  return (
    <>
      <PageHeader title="Novo profissional" description="Ele nasce com todos os serviços e um horário padrão (seg–sáb, 9h–18h). Ajuste em seguida." />
      <NewProfessionalForm />
    </>
  );
}

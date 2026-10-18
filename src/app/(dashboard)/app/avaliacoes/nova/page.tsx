import { exigirClinico } from "@/lib/treatments/access";
import { todayKey } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { AssessmentForm } from "../assessment-form";
import { opcoesDeAvaliacao } from "../options";

export default async function NovaAvaliacaoPage({ searchParams }: PageProps<"/app/avaliacoes/nova">) {
  const ctx = await exigirClinico();
  const sp = await searchParams;
  const o = await opcoesDeAvaliacao(ctx);
  return (
    <>
      <PageHeader title="Nova avaliação" />
      <AssessmentForm
        {...o}
        initial={{ clientId: typeof sp.cliente === "string" ? sp.cliente : undefined }}
        lockedProfessionalId={ctx.canManage ? undefined : ctx.user.professional?.id}
        today={todayKey(ctx.tenant.timezone)}
      />
    </>
  );
}

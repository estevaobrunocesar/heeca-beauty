import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigirClinico } from "@/lib/treatments/access";
import { toDateKey, todayKey } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { AssessmentForm } from "../assessment-form";
import { DeleteAssessmentButton } from "../delete-button";
import { opcoesDeAvaliacao } from "../options";

export default async function AvaliacaoPage({ params }: PageProps<"/app/avaliacoes/[id]">) {
  const { id } = await params;
  const ctx = await exigirClinico();
  const a = await db.assessment.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    include: { client: { select: { id: true, name: true } }, recommendedServices: { select: { serviceId: true } }, plan: { select: { id: true, name: true } } },
  });
  if (!a) notFound();
  // Sem gestão, só as próprias (a lista já filtra; aqui fecha o acesso direto pelo link).
  if (!ctx.canManage && !ctx.professionals.some((p) => p.id === a.professionalId)) notFound();
  const tz = ctx.tenant.timezone;
  const o = await opcoesDeAvaliacao(ctx);
  return (
    <>
      <div className="mb-4"><Link href="/app/avaliacoes" className="text-sm text-zinc-500 hover:underline">‹ Avaliações</Link></div>
      <PageHeader title={`Avaliação de ${a.client.name}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <AssessmentForm
          {...o}
          initial={{ id: a.id, clientId: a.clientId, professionalId: a.professionalId, performedAt: toDateKey(a.performedAt, tz), complaints: a.complaints, analysis: a.analysis, notes: a.notes, recommendedProtocolId: a.recommendedProtocolId, suggestedSessions: a.suggestedSessions, serviceIds: a.recommendedServices.map((s) => s.serviceId) }}
          lockedProfessionalId={ctx.canManage ? undefined : ctx.user.professional?.id}
          today={todayKey(tz)}
        />
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="font-medium">Plano de tratamento</h2>
            {a.plan ? (
              <>
                <p className="mt-1 text-sm text-zinc-600">{a.plan.name}</p>
                {ctx.canManage && <Link href={`/app/pacotes/${a.plan.id}`} className="btn-secondary mt-3 w-full">Abrir plano</Link>}
              </>
            ) : ctx.canManage ? (
              <>
                <p className="mt-1 text-sm text-zinc-500">Ainda sem plano. Crie a partir desta avaliação: cliente, protocolo e sessões já vêm preenchidos.</p>
                <Link href={`/app/pacotes/novo?avaliacao=${a.id}`} className="btn-primary mt-3 w-full">Criar plano</Link>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Ainda sem plano. A gestão cria o plano a partir desta avaliação.</p>
            )}
          </div>
          <div className="card p-5"><DeleteAssessmentButton id={a.id} /></div>
        </aside>
      </div>
    </>
  );
}

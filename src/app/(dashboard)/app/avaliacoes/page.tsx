import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { exigirClinico } from "@/lib/treatments/access";
import { fmtDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Avaliações" };

/** Avaliações iniciais (módulo clínico — Estética). Quem não é gestão vê só as próprias. */
export default async function AvaliacoesPage() {
  const ctx = await exigirClinico();
  const avaliacoes = await db.assessment.findMany({
    where: { tenantId: ctx.tenant.id, ...(ctx.canManage ? {} : { professionalId: { in: ctx.professionals.map((p) => p.id) } }) },
    orderBy: { performedAt: "desc" },
    take: 100,
    include: { client: { select: { name: true } }, professional: { select: { name: true } }, recommendedProtocol: { select: { name: true } }, plan: { select: { id: true } } },
  });
  return (
    <>
      <PageHeader
        title="Avaliações"
        description="O ponto de partida do tratamento: queixa, achados e o protocolo recomendado. Da avaliação nasce o plano da cliente."
        actions={<Link href="/app/avaliacoes/nova" className="btn-primary">+ Avaliação</Link>}
      />
      {avaliacoes.length === 0 ? (
        <EmptyState title="Nenhuma avaliação registrada" description="Registre a avaliação inicial da cliente para recomendar um protocolo e criar o plano." action={<Link href="/app/avaliacoes/nova" className="btn-primary">Registrar primeira avaliação</Link>} />
      ) : (
        <div className="card divide-y divide-zinc-100">
          {avaliacoes.map((a) => (
            <Link key={a.id} href={`/app/avaliacoes/${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-50">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{a.client.name} <span className="font-normal text-zinc-500">· {fmtDate(a.performedAt, ctx.tenant.timezone)} · {a.professional.name}</span></div>
                <div className="truncate text-xs text-zinc-500">{a.complaints ?? "Sem queixa registrada"}{a.recommendedProtocol ? ` · recomendado: ${a.recommendedProtocol.name}` : ""}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${a.plan ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{a.plan ? "Plano criado" : "Sem plano"}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

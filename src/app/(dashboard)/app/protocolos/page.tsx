import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { exigirClinico } from "@/lib/treatments/access";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProtocolRowActions } from "./row-actions";

export const metadata: Metadata = { title: "Protocolos" };

/** Protocolos de tratamento (módulo clínico — Estética): a receita que vira pacote ou plano avulso. */
export default async function ProtocolosPage() {
  const ctx = await exigirClinico({ gestao: true });
  const protocolos = await db.protocol.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { steps: { orderBy: { order: "asc" }, select: { service: { select: { name: true } } } }, _count: { select: { plans: true, packages: true } } },
  });
  return (
    <>
      <PageHeader
        title="Protocolos"
        description="A receita do tratamento: etapas em ordem, número de sessões e intervalo sugeridos. Vira um pacote do catálogo ou um plano avulso para a cliente."
        actions={<Link href="/app/protocolos/novo" className="btn-primary">+ Protocolo</Link>}
      />
      {protocolos.length === 0 ? (
        <EmptyState
          title="Nenhum protocolo cadastrado"
          description="Ex.: Detox facial — limpeza, esfoliação, extração e máscara, 6 sessões a cada 15 dias."
          action={<Link href="/app/protocolos/novo" className="btn-primary">Criar primeiro protocolo</Link>}
        />
      ) : (
        <div className="card divide-y divide-zinc-100">
          {protocolos.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${p.active ? "" : "opacity-60"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/app/protocolos/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  {!p.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Inativo</span>}
                </div>
                <p className="text-sm text-zinc-500">
                  {p.sessionsCount} sessões{p.intervalDays ? ` a cada ${p.intervalDays} dias` : ""} · {p.steps.map((s) => s.service.name).join(" → ")}
                </p>
                <p className="text-xs text-zinc-400">{p._count.packages} pacote(s) no catálogo · {p._count.plans} plano(s) vendido(s)</p>
              </div>
              <ProtocolRowActions id={p.id} active={p.active} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

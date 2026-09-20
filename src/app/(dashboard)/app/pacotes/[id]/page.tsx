import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { formatCents } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { itemCabeNoPacote, progresso, STATUS_PACOTE, STATUS_SESSAO } from "@/lib/packages/rules";
import { regraFaltaDe } from "@/lib/packages/service";
import { PackageTools } from "./package-tools";

/** Pacote vendido: saldo, sessões (uma por atendimento vinculado) e vínculo manual de atendimentos sem pacote. */
export default async function PacoteVendidoPage({ params }: PageProps<"/app/pacotes/[id]">) {
  const { id } = await params;
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const { tenant } = ctx;
  const tz = tenant.timezone;
  const pk = await db.clientPackage.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      service: { select: { name: true } }, category: { select: { name: true } },
      sessions: { orderBy: { createdAt: "asc" }, include: { item: { select: { id: true, appointmentId: true, startsAt: true, serviceName: true, professional: { select: { name: true } } } } } },
    },
  });
  if (!pk) notFound();
  const regra = regraFaltaDe(tenant);
  const p = progresso(pk, pk.sessions, regra);

  // Atendimentos do cliente que ainda não pertencem a nenhum pacote e cabem neste (vínculo manual).
  const candidatos = p.podeAgendar || pk.status === "ACTIVE"
    ? (await db.appointmentItem.findMany({
        where: { tenantId: tenant.id, appointment: { clientId: pk.clientId, status: { notIn: ["CANCELLED_BY_CLIENT", "CANCELLED_BY_PROFESSIONAL"] } }, packageSession: null },
        orderBy: { startsAt: "desc" }, take: 30,
        select: { id: true, serviceId: true, startsAt: true, serviceName: true, service: { select: { categoryId: true } } },
      })).filter((it) => itemCabeNoPacote(pk, { clientId: pk.clientId, serviceId: it.serviceId, categoryId: it.service.categoryId }).ok)
    : [];

  return (
    <>
      <div className="mb-4"><Link href="/app/pacotes" className="text-sm text-zinc-500 hover:underline">‹ Pacotes</Link></div>
      <PageHeader title={pk.name} description={`${pk.client.name} · ${pk.service?.name ?? (pk.category ? `qualquer serviço de ${pk.category.name}` : "qualquer serviço")} · ${formatCents(pk.priceCents)}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-3xl font-semibold tabular-nums">{p.restantes} <span className="text-base font-normal text-zinc-500">de {p.total} sessões restantes</span></div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${pk.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : pk.status === "COMPLETED" ? "bg-sky-100 text-sky-800" : "bg-zinc-100 text-zinc-600"}`}>{STATUS_PACOTE[pk.status]}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(p.usadas / p.total) * 100}%` }} /></div>
            <p className="mt-2 text-xs text-zinc-500">{p.usadas} usada(s) · {p.agendadas} agendada(s) · {p.disponiveis} livre(s) para marcar · início {fmtDate(pk.startsAt, "UTC")}{pk.expiresAt ? ` · válido até ${fmtDate(pk.expiresAt, "UTC")}` : " · sem validade"}{p.vencido ? " · vencido" : ""}</p>
            {pk.notes && <p className="mt-2 text-sm text-zinc-600">{pk.notes}</p>}
          </div>
          <div className="card">
            <h2 className="border-b border-zinc-100 px-4 py-3 font-medium">Sessões</h2>
            {pk.sessions.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">Nenhuma sessão ainda. Ao agendar um serviço coberto, ela aparece aqui.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {pk.sessions.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="w-6 text-zinc-400">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      {s.item ? (
                        <Link href={`/app/agendamentos/${s.item.appointmentId}`} className="hover:underline">{fmtDateTime(s.item.startsAt, tz)} · {s.item.serviceName} · {s.item.professional.name}</Link>
                      ) : (
                        <span className="text-zinc-500">Atendimento removido{s.performedAt ? ` · ${fmtDateTime(s.performedAt, tz)}` : ""}</span>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${s.status === "DONE" ? "bg-sky-100 text-sky-800" : s.status === "SCHEDULED" ? "bg-amber-100 text-amber-800" : s.status === "NO_SHOW" ? "bg-rose-100 text-rose-800" : "bg-zinc-100 text-zinc-600"}`}>{STATUS_SESSAO[s.status]}</span>
                    {s.item && s.status === "SCHEDULED" && <PackageTools kind="unlink" clientPackageId={pk.id} itemId={s.item.id} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="font-medium">Cliente</h2>
            <p className="mt-1 text-sm"><Link href={`/app/clientes/${pk.client.id}`} className="hover:underline">{pk.client.name}</Link></p>
            <Link href={`/app/agenda/novo?cliente=${encodeURIComponent(pk.client.phone)}`} className="btn-primary mt-3 w-full">Agendar sessão</Link>
            <PackageTools kind="status" clientPackageId={pk.id} status={pk.status} />
          </div>
          {candidatos.length > 0 && pk.status === "ACTIVE" && (
            <div className="card p-5">
              <h2 className="font-medium">Vincular atendimento</h2>
              <p className="text-xs text-zinc-500">Atendimentos deste cliente sem pacote que cabem aqui.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {candidatos.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{fmtDateTime(it.startsAt, tz)} · {it.serviceName}</span>
                    <PackageTools kind="link" clientPackageId={pk.id} itemId={it.id} disabled={p.disponiveis <= 0} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

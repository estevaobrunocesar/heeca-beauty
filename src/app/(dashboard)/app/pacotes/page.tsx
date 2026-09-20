import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { formatCents } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { progresso, STATUS_PACOTE } from "@/lib/packages/rules";
import { regraFaltaDe } from "@/lib/packages/service";
import { CatalogManager } from "./catalog-manager";
import { FaltaToggle } from "./falta-toggle";

/**
 * Pacotes de sessões: catálogo (o que o estabelecimento vende) e pacotes vendidos (saldo por cliente).
 * Ao agendar um serviço coberto, a sessão é reservada sozinha; ao concluir, é debitada.
 */
export default async function PacotesPage({ searchParams }: PageProps<"/app/pacotes">) {
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const { tenant } = ctx;
  const sp = await searchParams;
  const filtro = sp.status === "todos" ? undefined : "ACTIVE";

  const [catalogo, servicos, categorias, vendidos] = await Promise.all([
    db.package.findMany({ where: { tenantId: tenant.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { service: { select: { name: true } }, category: { select: { name: true } }, _count: { select: { sold: true } } } }),
    db.service.findMany({ where: { tenantId: tenant.id, deletedAt: null, isAddOn: false, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.serviceCategory.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.clientPackage.findMany({ where: { tenantId: tenant.id, ...(filtro ? { status: filtro } : {}) }, orderBy: { createdAt: "desc" }, take: 100, include: { client: { select: { id: true, name: true } }, sessions: { select: { status: true } } } }),
  ]);
  const regra = regraFaltaDe(tenant);

  return (
    <>
      <PageHeader
        title="Pacotes de sessões"
        description="Venda 5 ou 10 sessões de uma vez. Ao agendar um serviço coberto, a sessão é reservada; ao concluir, é debitada — o saldo é calculado, nunca digitado."
        actions={<Link href="/app/pacotes/novo" className="btn-primary" aria-disabled={catalogo.length === 0}>+ Vender pacote</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Pacotes vendidos</h2>
            <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs">
              <Link href="/app/pacotes" className={`rounded-md px-3 py-1 ${!sp.status ? "bg-zinc-900 text-white" : "text-zinc-600"}`}>Em andamento</Link>
              <Link href="/app/pacotes?status=todos" className={`rounded-md px-3 py-1 ${sp.status === "todos" ? "bg-zinc-900 text-white" : "text-zinc-600"}`}>Todos</Link>
            </div>
          </div>
          {vendidos.length === 0 ? (
            <div className="card px-6 py-10 text-center text-sm text-zinc-500">{catalogo.length === 0 ? "Crie um pacote no catálogo ao lado para começar a vender." : "Nenhum pacote vendido ainda."}</div>
          ) : (
            <div className="card divide-y divide-zinc-100">
              {vendidos.map((v) => {
                const p = progresso(v, v.sessions, regra);
                return (
                  <Link key={v.id} href={`/app/pacotes/${v.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-50">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{v.client.name} <span className="font-normal text-zinc-500">· {v.name}</span></div>
                      <div className="text-xs text-zinc-500">{p.usadas} de {p.total} usadas{p.agendadas ? ` · ${p.agendadas} agendada(s)` : ""}{v.expiresAt ? ` · válido até ${fmtDate(v.expiresAt, "UTC")}` : ""}</div>
                    </div>
                    <div className="h-1.5 w-24 shrink-0 rounded-full bg-zinc-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(p.usadas / p.total) * 100}%` }} /></div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${v.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : v.status === "COMPLETED" ? "bg-sky-100 text-sky-800" : "bg-zinc-100 text-zinc-600"}`}>{STATUS_PACOTE[v.status]}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <CatalogManager
            packages={catalogo.map((c) => ({ id: c.id, name: c.name, description: c.description, scope: c.serviceId ? `service:${c.serviceId}` : c.categoryId ? `category:${c.categoryId}` : "any", scopeLabel: c.service?.name ?? (c.category ? `Categoria ${c.category.name}` : "Qualquer serviço"), sessionsCount: c.sessionsCount, validityDays: c.validityDays, priceCents: c.priceCents, priceLabel: formatCents(c.priceCents), active: c.active, onlineVisible: c.onlineVisible, sold: c._count.sold }))}
            services={servicos}
            categories={categorias}
          />
          <FaltaToggle consome={tenant.faltaConsomeSessao} />
        </aside>
      </div>
    </>
  );
}

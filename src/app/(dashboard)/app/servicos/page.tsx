import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { formatCents } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { categoryIcon, groupByCategory, UNCATEGORIZED_LABEL } from "@/lib/services/categories";
import { listCategories } from "@/lib/services/categories-db";
import { ServiceRowActions } from "./row-actions";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesPage() {
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const { tenant } = ctx;
  const [services, categories] = await Promise.all([
    db.service.findMany({ where: { tenantId: tenant.id, deletedAt: null }, orderBy: { sortOrder: "asc" } }),
    listCategories(tenant.id),
  ]);
  const main = services.filter((s) => !s.isAddOn);
  const addOns = services.filter((s) => s.isAddOn);
  const counts: Record<string, number> = {};
  for (const s of main) if (s.categoryId) counts[s.categoryId] = (counts[s.categoryId] ?? 0) + 1;

  return (
    <>
      <PageHeader
        title="Serviços"
        description="O que as clientes podem agendar, agrupado por categoria. A ordem aqui é a ordem da página pública."
        actions={
          <>
            <Link href="/app/servicos/novo?tipo=adicional" className="btn-secondary">+ Adicional</Link>
            <Link href="/app/servicos/novo" className="btn-primary">+ Serviço</Link>
          </>
        }
      />

      <div className="mb-6"><CategoryManager categories={categories} counts={counts} /></div>

      {services.length === 0 ? (
        <EmptyState
          title="Nenhum serviço cadastrado"
          description="Cadastre ao menos um serviço (ex.: Corte feminino, 45 min, R$ 80) para liberar sua página de agendamento."
          action={<Link href="/app/servicos/novo" className="btn-primary">Cadastrar primeiro serviço</Link>}
        />
      ) : (
        <div className="space-y-8">
          {groupByCategory(main, categories).map((group) => (
            <section key={group.category?.id ?? "sem-categoria"}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                <span>{group.category ? categoryIcon(group.category.slug) : "✨"}</span> {group.category?.name ?? UNCATEGORIZED_LABEL}
              </h2>
              <ServiceList items={group.items} all={services} />
            </section>
          ))}

          <section>
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              <span>💎</span> Adicionais
            </h2>
            <p className="mb-2 text-xs text-zinc-500">A cliente marca junto com um procedimento; cada um soma tempo e valor ao agendamento.</p>
            {addOns.length === 0 ? (
              <div className="card px-4 py-6 text-center text-sm text-zinc-500">
                Nenhum adicional. <Link href="/app/servicos/novo?tipo=adicional" className="text-brand-600 underline">Cadastrar nail art, francesinha, pedrarias…</Link>
              </div>
            ) : (
              <ServiceList items={addOns} all={services} addOn />
            )}
          </section>
        </div>
      )}
    </>
  );
}

type Row = { id: string; name: string; description: string | null; durationMinutes: number; priceCents: number; imageUrl: string | null; active: boolean; isAddOn: boolean };

function ServiceList({ items, all, addOn }: { items: Row[]; all: Row[]; addOn?: boolean }) {
  return (
    <div className="card divide-y divide-zinc-100">
      {items.map((s) => {
        const idx = all.findIndex((x) => x.id === s.id);
        return (
          <div key={s.id} className={`flex items-center gap-4 px-4 py-3 ${s.active ? "" : "opacity-60"}`}>
            {s.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg">{addOn ? "💎" : "✨"}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/app/servicos/${s.id}`} className="font-medium text-zinc-900 hover:underline">{s.name}</Link>
                {!s.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Inativo</span>}
              </div>
              <p className="truncate text-sm text-zinc-500">
                {addOn ? `+ ${s.durationMinutes} min · + ${formatCents(s.priceCents)}` : `${s.durationMinutes} min · ${formatCents(s.priceCents)}`}
                {s.description ? ` · ${s.description}` : ""}
              </p>
            </div>
            <ServiceRowActions id={s.id} active={s.active} isFirst={idx === 0} isLast={idx === all.length - 1} />
          </div>
        );
      })}
    </div>
  );
}

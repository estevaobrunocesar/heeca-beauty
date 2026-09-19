import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtDate } from "@/lib/dates";
import { PortfolioItemActions } from "./item-actions";

export const metadata: Metadata = { title: "Portfólio" };

export default async function PortfolioPage() {
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const { tenant } = ctx;
  const items = await db.portfolioItem.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
    include: { category: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Portfólio"
        description="Fotos dos seus trabalhos. As visíveis aparecem na galeria da sua página de agendamento, nesta ordem."
        actions={<Link href="/app/portfolio/novo" className="btn-primary">+ Nova foto</Link>}
      />

      {items.length === 0 ? (
        <EmptyState
          title="Sua galeria está vazia"
          description="Publique fotos de alongamentos, nail art, esmaltações em gel… É o que mais convence uma cliente nova a agendar."
          action={<Link href="/app/portfolio/novo" className="btn-primary">Publicar primeira foto</Link>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it, i) => (
            <div key={it.id} className={`card overflow-hidden ${it.visible ? "" : "opacity-60"}`}>
              <Link href={`/app/portfolio/${it.id}`} className="block aspect-square bg-zinc-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.imageUrl} alt={it.title} className="h-full w-full object-cover" />
              </Link>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/app/portfolio/${it.id}`} className="line-clamp-1 text-sm font-medium hover:underline">{it.title}</Link>
                  {!it.visible && <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">Oculta</span>}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {it.category ? `${it.category.name} · ` : ""}{fmtDate(it.publishedAt, tenant.timezone)}
                </p>
                <PortfolioItemActions id={it.id} visible={it.visible} isFirst={i === 0} isLast={i === items.length - 1} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

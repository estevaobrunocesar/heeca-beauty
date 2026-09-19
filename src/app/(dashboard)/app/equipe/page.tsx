import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { TeamRowActions } from "./row-actions";
import { Avatar } from "@/components/dashboard/avatar";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamPage() {
  const ctx = await requireAuth();
  // STAFF só vê a própria página
  if (!ctx.canManage) redirect(`/app/equipe/${ctx.professional.id}`);

  const team = await db.professional.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { email: true, role: true } }, _count: { select: { services: true } }, availability: { select: { weekday: true } } },
  });

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Quem atende no seu estabelecimento. Cada profissional tem seus próprios horários, serviços e agenda."
        actions={<Link href="/app/equipe/novo" className="btn-primary">+ Novo profissional</Link>}
      />
      <div className="card divide-y divide-zinc-100">
        {team.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-4 px-4 py-3 ${p.active ? "" : "opacity-60"}`}>
            <Avatar name={p.name} photoUrl={p.photoUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/app/equipe/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                {p.user?.role === "OWNER" && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">Responsável</span>}
                {!p.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Inativo</span>}
              </div>
              <p className="truncate text-sm text-zinc-500">
                {p._count.services} serviço(s) · {p.availability.length} dia(s)/semana
                {p.user ? ` · acesso: ${p.user.email}` : " · sem acesso ao painel"}
              </p>
            </div>
            <TeamRowActions id={p.id} isFirst={i === 0} isLast={i === team.length - 1} />
          </div>
        ))}
      </div>
    </>
  );
}

import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { logoutAction } from "@/actions/auth";
import { DashboardNav } from "@/components/dashboard/nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { tenant, user, isOwner, professional } = await requireAuth();

  return (
    <div className="flex flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-5 md:flex">
        <Link href="/app" className="mb-6 px-2 text-xl font-semibold tracking-tight">
          Heeca<span className="text-brand-500">.</span>
        </Link>
        <DashboardNav variant="sidebar" isOwner={isOwner} />
        <div className="mt-auto space-y-3 border-t border-zinc-200 pt-4">
          <Link
            href={`/agendar/${tenant.slug}`}
            target="_blank"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <span>↗</span> Ver página pública
          </Link>
          <div className="px-3">
            <p className="truncate text-sm font-medium text-zinc-800">{tenant.businessName}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
            {!isOwner && <Link href={`/app/equipe/${professional.id}`} className="mt-1 block text-xs text-zinc-600 hover:underline">Meu perfil e horários</Link>}
          </div>
          <form action={logoutAction} className="px-3">
            <button className="text-xs text-zinc-500 hover:text-zinc-900">Sair</button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <span className="text-lg font-semibold">
            Heeca<span className="text-brand-500">.</span>
          </span>
          <form action={logoutAction}>
            <button className="text-xs text-zinc-500">Sair</button>
          </form>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <DashboardNav variant="bottom" isOwner={isOwner} />
    </div>
  );
}

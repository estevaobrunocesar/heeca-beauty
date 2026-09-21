import Link from "next/link";
import { HEECA_PRODUCTS, HeecaAppIcon, type HeecaProduct } from "@/components/brand/logo";
import { DashboardNav, type NavRole } from "@/components/dashboard/nav";
import { Avatar } from "@/components/dashboard/avatar";
import { logoutAction } from "@/actions/auth";
import { portalUrl } from "@/lib/heeca/service";
import type { Marca } from "@/lib/marca";

/**
 * Casca do painel (padrão Heeca): sidebar branca à esquerda no desktop (ícone do produto, navegação, cartão do
 * plano), barra superior com busca, data, pendências e perfil; no celular a sidebar vira barra inferior e a
 * barra superior encolhe. A cor de ação vem de --color-brand-* (paleta da marca aplicada pelo layout).
 */
export type ShellProps = {
  marca: Marca;
  tenant: { slug: string; businessName: string; heecaPlan: string | null; salasAtivas: boolean };
  user: { name: string; email: string };
  role: NavRole;
  canManage: boolean;
  professionalId: string;
  professionalLabel: string;
  pendentes: number;
  hoje: string;
  children: React.ReactNode;
};

const PLANOS: Record<string, { nome: string; proximo?: { nome: string; ganho: string } }> = {
  solo: { nome: "Solo", proximo: { nome: "Salão", ganho: "equipe, comissões e sinal via Pix" } },
  salao: { nome: "Salão", proximo: { nome: "Salão Plus", ganho: "perfis gerente e recepção e templates próprios" } },
  "salao-plus": { nome: "Salão Plus" },
  rede: { nome: "Rede" },
  studio: { nome: "Studio" },
  "studio-plus": { nome: "Studio Plus" },
};

export function AppShell({ marca, tenant, user, role, canManage, professionalId, professionalLabel, pendentes, hoje, children }: ShellProps) {
  const produto = (marca.slug in HEECA_PRODUCTS ? marca.slug : "heeca") as HeecaProduct;
  const plano = tenant.heecaPlan ? PLANOS[tenant.heecaPlan] ?? { nome: tenant.heecaPlan } : null;
  const nomeCurto = marca.nome.replace(/^Heeca /, "");
  return (
    <div className="flex min-h-full flex-1">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line bg-white px-4 py-5 md:flex">
        <Link href="/app" className="mb-5 flex items-center gap-2.5 px-1.5">
          <HeecaAppIcon product={produto} size={38} radius={10} className="shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-bold tracking-[-0.03em]">Heeca <span className="font-medium text-brand-600">{nomeCurto}</span></span>
            <span className="block truncate text-[11px] font-medium text-mut">{tenant.businessName}</span>
          </span>
        </Link>
        <DashboardNav variant="sidebar" role={role} salas={tenant.salasAtivas} />
        <div className="mt-auto space-y-3 pt-4">
          {plano && (
            <div className="rounded-[14px] border border-brand-100 bg-brand-50/60 p-4">
              <div className="mb-2 grid size-9 place-items-center rounded-[10px] bg-white text-brand-600">
                <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l3-10 6 5 6-5 3 10z" /><path d="M3 20h18" /></svg>
              </div>
              <b className="block text-[13px]">Plano {plano.nome}</b>
              {plano.proximo ? (
                <>
                  <p className="mb-3 text-xs text-mut">Passe para o {plano.proximo.nome} e tenha {plano.proximo.ganho}.</p>
                  <a href={`${portalUrl()}/conta`} target="_blank" rel="noreferrer" className="btn-primary w-full">Conhecer o {plano.proximo.nome}</a>
                </>
              ) : (
                <p className="text-xs text-mut">Todos os recursos liberados.</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 px-1.5">
            <Avatar name={user.name} photoUrl={null} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-mut">{professionalLabel}</p>
            </div>
            <form action={logoutAction}><button className="link-mut" title="Sair">Sair</button></form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur md:border-0 md:bg-transparent md:backdrop-blur-none">
          <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 md:px-6 md:pt-5 md:pb-0">
            <Link href="/app" className="flex items-center gap-2 md:hidden">
              <HeecaAppIcon product={produto} size={30} radius={8} />
              <span className="text-[15px] font-bold tracking-[-0.03em]">Heeca <span className="font-medium text-brand-600">{nomeCurto}</span></span>
            </Link>
            <form action="/app/clientes" className="hidden min-w-0 flex-1 md:block md:max-w-[340px]">
              <label className="flex items-center gap-2.5 rounded-[10px] border border-line bg-white px-3 py-2 text-mut-2 focus-within:border-brand-500">
                <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input name="q" placeholder="Buscar cliente…" className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-mut-2" />
              </label>
            </form>
            <div className="flex-1 md:flex-1" />
            <span className="hidden items-center gap-2 rounded-[10px] border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink-2 md:flex">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
              {hoje}
            </span>
            <Link href="/app/agenda" className="relative grid size-9 place-items-center rounded-[10px] border border-line bg-white text-ink-2 hover:bg-zinc-50" title={pendentes ? `${pendentes} agendamento(s) aguardando` : "Agenda"}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16z" /><path d="M10 21h4" /></svg>
              {pendentes > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-600 px-1.5 text-[9.5px] font-bold leading-4 text-white">{pendentes > 9 ? "9+" : pendentes}</span>}
            </Link>
            <a href={`/agendar/${tenant.slug}`} target="_blank" rel="noreferrer" className="hidden size-9 place-items-center rounded-[10px] border border-line bg-white text-ink-2 hover:bg-zinc-50 md:grid" title="Ver página pública">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
            </a>
            <Link href={canManage ? "/app/configuracoes" : `/app/equipe/${professionalId}`} className="flex items-center gap-2.5 md:pl-1">
              <Avatar name={user.name} photoUrl={null} size="sm" />
              <span className="hidden min-w-0 md:block">
                <span className="block truncate text-[13px] font-semibold">{user.name}</span>
                <span className="block truncate text-[11px] text-mut">{professionalLabel}</span>
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-24 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>
      </div>
      <DashboardNav variant="bottom" role={role} salas={tenant.salasAtivas} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavRole = "OWNER" | "MANAGER" | "RECEPTION" | "STAFF";

// Quem vê cada item (SPEC §6). "manage" = dono e gerente; "commission" = todos menos recepção.
const items: { href: string; label: string; icon: (p: IconProps) => React.JSX.Element; access: "all" | "manage" | "commission"; opcional?: "salas" }[] = [
  { href: "/app", label: "Início", icon: HomeIcon, access: "all" },
  { href: "/app/agenda", label: "Agenda", icon: CalendarIcon, access: "all" },
  { href: "/app/servicos", label: "Serviços", icon: ServicesIcon, access: "manage" },
  { href: "/app/clientes", label: "Clientes", icon: UsersIcon, access: "all" },
  { href: "/app/comissoes", label: "Comissões", icon: CommissionIcon, access: "commission" },
  { href: "/app/salas", label: "Salas", icon: RoomIcon, access: "manage", opcional: "salas" },
  { href: "/app/pacotes", label: "Pacotes", icon: PackageIcon, access: "manage" },
  { href: "/app/portfolio", label: "Portfólio", icon: GalleryIcon, access: "manage" },
  { href: "/app/equipe", label: "Equipe", icon: TeamIcon, access: "manage" },
  { href: "/app/configuracoes", label: "Configurações", icon: SettingsIcon, access: "manage" },
];

export function DashboardNav({ variant, role, salas = false }: { variant: "sidebar" | "bottom"; role: NavRole; salas?: boolean }) {
  const canManage = role === "OWNER" || role === "MANAGER";
  const visible = items
    .filter((i) => !i.opcional || (i.opcional === "salas" && salas))
    .filter((i) => i.access === "all" || (i.access === "manage" && canManage) || (i.access === "commission" && role !== "RECEPTION"));
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  if (variant === "sidebar") {
    return (
      <nav className="flex flex-col gap-0.5">
        {visible.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition ${
              isActive(href) ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-zinc-100 hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  // Mobile: barra inferior com os 4 principais + "Mais" (folha com o restante)
  return <BottomNav visible={visible} isActive={isActive} />;
}

function BottomNav({ visible, isActive }: { visible: typeof items; isActive: (href: string) => boolean }) {
  // A folha "Mais" fica aberta só na rota em que foi aberta: navegar fecha sem precisar de efeito.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const pathname = usePathname();
  const aberto = abertoEm === pathname;
  const setAberto = (v: boolean) => setAbertoEm(v ? pathname : null);
  const principais = visible.slice(0, 4);
  const resto = visible.slice(4);
  const restoAtivo = resto.some((i) => isActive(i.href));
  const item = (href: string, label: string, Icon: (p: IconProps) => React.JSX.Element, ativo: boolean) => (
    <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium ${ativo ? "text-brand-600" : "text-mut"}`}>
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-20 bg-ink/30 md:hidden" onClick={() => setAberto(false)}>
          <div className="absolute inset-x-0 bottom-[60px] rounded-t-2xl border-t border-line bg-white p-3 pb-2" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
            <div className="grid grid-cols-4 gap-1">
              {resto.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className={`flex flex-col items-center gap-1 rounded-[10px] px-1 py-2.5 text-[10.5px] font-medium ${isActive(href) ? "bg-brand-50 text-brand-700" : "text-ink-2"}`}>
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {principais.map(({ href, label, icon: Icon }) => item(href, label, Icon, isActive(href)))}
        {resto.length > 0 && (
          <button type="button" onClick={() => setAberto(!aberto)} className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium ${aberto || restoAtivo ? "text-brand-600" : "text-mut"}`}>
            <MoreIcon className="h-5 w-5" />
            Mais
          </button>
        )}
      </nav>
    </>
  );
}

type IconProps = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };

function MoreIcon(p: IconProps) {
  return <svg {...base} {...p}><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>;
}
function HomeIcon(p: IconProps) {
  return <svg {...base} {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg>;
}
function CommissionIcon(p: IconProps) {
  // Cifrão em círculo
  return <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M14.5 9.5c0-1-1.1-1.7-2.5-1.7s-2.5.7-2.5 1.7 1.1 1.5 2.5 1.7 2.5.8 2.5 1.8-1.1 1.7-2.5 1.7-2.5-.7-2.5-1.7" /></svg>;
}
function CalendarIcon(p: IconProps) {
  return <svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
}
function ServicesIcon(p: IconProps) {
  // Frasco de esmalte
  return <svg {...base} {...p}><path d="M9 3h6v4H9z" /><path d="M8 7h8l1 4v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8z" /><path d="M9 15h6" /></svg>;
}
function GalleryIcon(p: IconProps) {
  return <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-8 8" /></svg>;
}
function UsersIcon(p: IconProps) {
  return <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" /></svg>;
}
function TeamIcon(p: IconProps) {
  return <svg {...base} {...p}><circle cx="8" cy="7" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M2 20a6 6 0 0 1 12 0" /><path d="M14 20a5 5 0 0 1 8 0" /></svg>;
}
function PackageIcon(p: IconProps) {
  return <svg {...base} {...p}><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" /></svg>;
}
function RoomIcon(p: IconProps) {
  return <svg {...base} {...p}><path d="M3 21V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16" /><path d="M3 21h18" /><path d="M9 21v-6h6v6" /><path d="M8 9h2M14 9h2" /></svg>;
}
function SettingsIcon(p: IconProps) {
  return <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
}

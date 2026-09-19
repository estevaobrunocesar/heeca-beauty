"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/app/configuracoes", label: "Negócio e link" },
  { href: "/app/configuracoes/horarios", label: "Horários e regras" },
  { href: "/app/configuracoes/politicas", label: "Políticas" },
  { href: "/app/configuracoes/whatsapp", label: "WhatsApp" },
  { href: "/app/configuracoes/pagamentos", label: "Pagamentos" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-zinc-200">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              active ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

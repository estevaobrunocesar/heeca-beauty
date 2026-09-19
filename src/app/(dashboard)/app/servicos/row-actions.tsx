"use client";

import { useTransition } from "react";
import Link from "next/link";
import { deleteServiceAction, moveServiceAction, toggleServiceAction } from "@/actions/services";

export function ServiceRowActions({ id, active, isFirst, isLast }: { id: string; active: boolean; isFirst: boolean; isLast: boolean }) {
  const [pending, start] = useTransition();
  const iconBtn = "rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button className={iconBtn} disabled={pending || isFirst} title="Subir" onClick={() => start(() => moveServiceAction(id, "up"))}>↑</button>
      <button className={iconBtn} disabled={pending || isLast} title="Descer" onClick={() => start(() => moveServiceAction(id, "down"))}>↓</button>
      <button
        className="btn-ghost px-2 py-1 text-xs"
        disabled={pending}
        onClick={() => start(() => toggleServiceAction(id))}
      >
        {active ? "Desativar" : "Ativar"}
      </button>
      <Link href={`/app/servicos/${id}`} className="btn-ghost px-2 py-1 text-xs">Editar</Link>
      <button
        className="btn-ghost px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
        disabled={pending}
        onClick={() => {
          if (confirm("Excluir este serviço? Ele deixará de aparecer na página pública.")) start(() => deleteServiceAction(id));
        }}
      >
        Excluir
      </button>
    </div>
  );
}

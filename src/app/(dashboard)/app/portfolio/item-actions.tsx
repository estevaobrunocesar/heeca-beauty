"use client";

import { useTransition } from "react";
import { deletePortfolioItemAction, movePortfolioItemAction, togglePortfolioItemAction } from "@/actions/portfolio";

export function PortfolioItemActions({ id, visible, isFirst, isLast }: { id: string; visible: boolean; isFirst: boolean; isLast: boolean }) {
  const [pending, start] = useTransition();
  const iconBtn = "rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30";
  return (
    <div className="mt-2 flex items-center gap-1 text-xs">
      <button className={iconBtn} disabled={pending || isFirst} title="Mover para antes" onClick={() => start(() => movePortfolioItemAction(id, "up"))}>←</button>
      <button className={iconBtn} disabled={pending || isLast} title="Mover para depois" onClick={() => start(() => movePortfolioItemAction(id, "down"))}>→</button>
      <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => togglePortfolioItemAction(id))}>
        {visible ? "Ocultar" : "Mostrar"}
      </button>
      <button
        className="btn-ghost px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
        disabled={pending}
        onClick={() => { if (confirm("Excluir esta foto do portfólio?")) start(() => deletePortfolioItemAction(id)); }}
      >
        Excluir
      </button>
    </div>
  );
}

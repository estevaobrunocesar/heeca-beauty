"use client";

import { useTransition } from "react";
import Link from "next/link";
import { moveProfessionalAction } from "@/actions/professionals";

export function TeamRowActions({ id, isFirst, isLast }: { id: string; isFirst: boolean; isLast: boolean }) {
  const [pending, start] = useTransition();
  const iconBtn = "rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button className={iconBtn} disabled={pending || isFirst} title="Subir" onClick={() => start(() => moveProfessionalAction(id, "up"))}>↑</button>
      <button className={iconBtn} disabled={pending || isLast} title="Descer" onClick={() => start(() => moveProfessionalAction(id, "down"))}>↓</button>
      <Link href={`/app/equipe/${id}`} className="btn-ghost px-2 py-1 text-xs">Editar</Link>
    </div>
  );
}

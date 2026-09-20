"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setSalasAtivasAction } from "@/actions/rooms";

/** Opção do estabelecimento: agenda por sala e recursos (spa, clínica de estética com salas e equipamentos). */
export function SalasToggle({ ativas }: { ativas: boolean }) {
  const [on, setOn] = useState(ativas);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Agenda por sala e recursos</h2>
          <p className="mt-1 text-sm text-zinc-500">Para quem tem salas, banheira, sauna ou macas que não podem ser vendidas duas vezes no mesmo horário. Cada serviço diz se precisa de sala e quais recursos consome; o horário só é oferecido quando profissional, sala e recursos estão livres.</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox" checked={on} disabled={pending} className="h-4 w-4 rounded border-zinc-300"
            onChange={(e) => { const v = e.target.checked; setOn(v); start(async () => { const r = await setSalasAtivasAction(v); setMsg((r?.ok ? r.message : r?.error) ?? null); }); }}
          />
          {on ? "Ligada" : "Desligada"}
        </label>
      </div>
      {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}
      {on && <Link href="/app/salas" className="btn-secondary mt-4 inline-flex">Cadastrar salas e recursos</Link>}
    </section>
  );
}

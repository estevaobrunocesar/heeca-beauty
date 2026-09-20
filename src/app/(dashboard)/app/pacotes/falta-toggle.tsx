"use client";

import { useState, useTransition } from "react";
import { setFaltaConsomeSessaoAction } from "@/actions/packages";

/** Política do estabelecimento: falta (não compareceu sem aviso) desconta a sessão do pacote? */
export function FaltaToggle({ consome }: { consome: boolean }) {
  const [on, setOn] = useState(consome);
  const [pending, start] = useTransition();
  return (
    <section className="card p-4 text-sm">
      <label className="flex cursor-pointer items-start gap-2">
        <input type="checkbox" checked={on} disabled={pending} className="mt-0.5 h-4 w-4 rounded border-zinc-300" onChange={(e) => { const v = e.target.checked; setOn(v); start(async () => { await setFaltaConsomeSessaoAction(v); }); }} />
        <span>
          <span className="font-medium">Falta desconta a sessão</span>
          <span className="block text-xs text-zinc-500">Cliente que não comparece sem aviso perde a sessão do pacote. Desligado: a sessão volta ao saldo. Cancelamento nunca desconta.</span>
        </span>
      </label>
    </section>
  );
}

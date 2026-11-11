"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unificarClientesAction } from "@/actions/clients";
import { Alert } from "@/components/ui/alert";

type Grupo = { principalId: string; nome: string; temTelefone: boolean; atendimentosTotal: number; duplicadasIds: string[] };

/** Cadastros com o mesmo nome (a mesma pessoa agendada sem telefone várias vezes): uma ação por grupo, com confirmação. */
export function UnificarClientes({ grupos }: { grupos: Grupo[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (grupos.length === 0) return null;

  const unificar = (g: Grupo) => {
    if (!window.confirm(`Juntar ${g.duplicadasIds.length + 1} cadastros de "${g.nome}" em um só? Os atendimentos de todos passam para um único cadastro. Não dá para desfazer.`)) return;
    setMsg(null);
    start(async () => {
      const r = await unificarClientesAction(g.principalId, g.duplicadasIds);
      setMsg(r && !r.ok ? { ok: false, text: r.error } : { ok: true, text: (r && r.ok && r.message) || "Unificado." });
      router.refresh();
    });
  };

  return (
    <section className="card mb-4 p-4">
      <h2 className="font-medium">Cadastros repetidos ({grupos.length})</h2>
      <p className="text-sm text-zinc-500">Mesmo nome, no máximo um com telefone. Confira se é a mesma pessoa antes de juntar.</p>
      {msg && <div className="mt-2"><Alert kind={msg.ok ? "success" : "error"}>{msg.text}</Alert></div>}
      <ul className="mt-3 divide-y divide-zinc-100">
        {grupos.map((g) => (
          <li key={g.principalId} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 text-sm">
              <span className="font-medium">{g.nome}</span>
              <span className="block text-zinc-500">{g.duplicadasIds.length + 1} cadastros · {g.atendimentosTotal} atendimentos{g.temTelefone ? "" : " · nenhum com telefone"}</span>
            </span>
            <button type="button" className="btn-secondary shrink-0 px-3 py-1.5 text-sm" disabled={pending} onClick={() => unificar(g)}>Unificar</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

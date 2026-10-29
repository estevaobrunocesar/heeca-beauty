"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProfessionalAction } from "@/actions/professionals";

export function DeleteProfessionalButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card p-5 text-sm">
      <h2 className="font-medium text-zinc-900">Excluir da equipe</h2>
      <p className="mt-1 text-zinc-600">Remove {name}, os horários e o acesso ao painel. Só é possível se não houver atendimentos no histórico; nesse caso, desative no perfil.</p>
      <button
        type="button" disabled={pending} className="btn-ghost mt-3 w-full text-rose-600 hover:bg-rose-50"
        onClick={() => {
          if (!confirm(`Excluir ${name} da equipe? Isso não pode ser desfeito.`)) return;
          start(async () => { const r = await deleteProfessionalAction(id); if (r?.ok) router.push("/app/equipe"); else setError(r?.ok === false ? r.error : "Erro"); });
        }}
      >Excluir profissional</button>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </section>
  );
}

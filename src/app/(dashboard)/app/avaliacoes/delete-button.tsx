"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAssessmentAction } from "@/actions/treatments";

export function DeleteAssessmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button" disabled={pending} className="btn-ghost w-full text-rose-600 hover:bg-rose-50"
        onClick={() => {
          if (!confirm("Excluir esta avaliação? O plano criado a partir dela é mantido.")) return;
          start(async () => { const r = await deleteAssessmentAction(id); if (r?.ok) router.push("/app/avaliacoes"); else setError(r?.error ?? "Erro"); });
        }}
      >Excluir avaliação</button>
      {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

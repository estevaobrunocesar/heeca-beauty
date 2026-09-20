"use client";

import { useActionState } from "react";
import { updateSegmentosAction } from "@/actions/settings";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

type SegmentoResumo = { slug: string; nome: string; icone: string; publico: string; categorias: string[]; ficha: string[] };

/** Caixas de seleção dos segmentos da marca; `ativos` vazio = ainda não escolheu (nenhuma marcada). */
export function SegmentosForm({ segmentos, ativos }: { segmentos: SegmentoResumo[]; ativos: string[] }) {
  const [state, action] = useActionState(updateSegmentosAction, null);
  return (
    <form action={action} className="card space-y-5 p-6">
      <div>
        <h2 className="font-medium">O que você faz?</h2>
        <p className="mt-1 text-sm text-zinc-500">Marque os segmentos que o seu estabelecimento atende. Pode ser um só (nail designer autônoma) ou vários (salão completo).</p>
      </div>
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {segmentos.map((s) => (
          <li key={s.slug}>
            <label className="flex h-full cursor-pointer gap-3 rounded-xl border border-zinc-200 p-4 hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
              <input type="checkbox" name={`segmento.${s.slug}`} defaultChecked={ativos.includes(s.slug)} className="mt-1 size-4 accent-brand-600" />
              <span className="min-w-0">
                <span className="block font-medium">{s.icone} {s.nome}</span>
                <span className="block text-xs text-zinc-500">para {s.publico}</span>
                <span className="mt-1 block text-xs text-zinc-500">Categorias: {s.categorias.join(", ")}</span>
                {s.ficha.length > 0 && <span className="block text-xs text-zinc-400">Ficha: {s.ficha.join(" · ")}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <SubmitButton>Salvar segmentos</SubmitButton>
    </form>
  );
}

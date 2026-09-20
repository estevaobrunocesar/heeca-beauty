"use client";

import { useActionState, useState, useTransition } from "react";
import { createResourceAction, toggleResourceAction, updateResourceAction } from "@/actions/rooms";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

export type ResourceRow = { id: string; name: string; quantity: number; description: string | null; active: boolean; services: number };

/** Recursos compartilhados com quantidade (banheira, sauna, macas): o serviço diz quantas unidades consome. */
export function ResourcesManager({ resources }: { resources: ResourceRow[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(createResourceAction, null);
  return (
    <section className="card">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="font-medium">Recursos <span className="font-normal text-zinc-400">({resources.length})</span></h2>
        <p className="text-xs text-zinc-500">Equipamentos compartilhados entre salas: a quantidade limita quantos serviços os usam ao mesmo tempo.</p>
      </div>
      <div className="divide-y divide-zinc-100">
        {resources.map((r) => <ResourceLine key={r.id} resource={r} />)}
        {resources.length === 0 && <p className="px-4 py-6 text-center text-sm text-zinc-500">Nenhum recurso ainda (ex.: 1 banheira, 2 macas térmicas).</p>}
        <form action={formAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto_auto]">
          <input name="name" required maxLength={60} className="input" placeholder="Nome (ex.: Banheira de ofurô)" />
          <input name="quantity" type="number" min={1} max={99} defaultValue={1} className="input w-24" title="Quantidade" />
          <SubmitButton>Adicionar</SubmitButton>
          {state && !state.ok && <div className="sm:col-span-3"><Alert>{state.error}</Alert></div>}
        </form>
      </div>
    </section>
  );
}

function ResourceLine({ resource }: { resource: ResourceRow }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (prev, fd) => { const r = await updateResourceAction(resource.id, prev, fd); if (r?.ok) setEditing(false); return r; },
    null,
  );
  if (editing) {
    return (
      <form action={formAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto]">
        <input name="name" defaultValue={resource.name} required maxLength={60} className="input" autoFocus />
        <input name="quantity" type="number" min={1} max={99} defaultValue={resource.quantity} className="input w-24" />
        <input name="description" defaultValue={resource.description ?? ""} maxLength={300} className="input sm:col-span-2" placeholder="Descrição (opcional)" />
        <div className="flex items-center gap-2 sm:col-span-2">
          <SubmitButton>Salvar</SubmitButton>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(false)}>Cancelar</button>
          {state && !state.ok && <span className="text-xs text-rose-600">{state.error}</span>}
        </div>
      </form>
    );
  }
  return (
    <div className={`flex items-center gap-2 px-4 py-2 ${resource.active ? "" : "opacity-50"}`}>
      <span className="flex-1 text-sm">
        <span className="font-medium">{resource.name}</span>
        <span className="ml-2 text-xs text-zinc-500">· {resource.quantity} {resource.quantity === 1 ? "unidade" : "unidades"}</span>
        <span className="ml-2 text-xs text-zinc-400">· {resource.services} {resource.services === 1 ? "serviço" : "serviços"}</span>
        {!resource.active && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">desativado</span>}
      </span>
      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(true)}>Editar</button>
      <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => toggleResourceAction(resource.id))}>{resource.active ? "Desativar" : "Reativar"}</button>
    </div>
  );
}

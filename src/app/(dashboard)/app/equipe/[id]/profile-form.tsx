"use client";

import { useActionState } from "react";
import { updateProfessionalAction } from "@/actions/professionals";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

type Props = {
  id: string;
  isOwner: boolean;
  initial: { name: string; bio: string; photoUrl: string; active: boolean };
  services: { id: string; name: string; active: boolean; checked: boolean }[];
};

export function ProfileForm({ id, isOwner, initial, services }: Props) {
  const [state, action] = useActionState<ActionResult, FormData>(updateProfessionalAction.bind(null, id), null);
  return (
    <form action={action} className="card space-y-4 p-6">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Nome</label>
          <input id="name" name="name" required className="input" defaultValue={initial.name} />
        </div>
        <div>
          <label className="label" htmlFor="photoUrl">URL da foto</label>
          <input id="photoUrl" name="photoUrl" type="url" className="input" defaultValue={initial.photoUrl} placeholder="https://..." />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bio">Descrição curta</label>
        <input id="bio" name="bio" className="input" defaultValue={initial.bio} placeholder="Aparece na página pública ao escolher o profissional" />
      </div>

      {isOwner && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4 rounded border-zinc-300" />
            Ativo (aparece na página pública e recebe agendamentos)
          </label>

          <fieldset>
            <legend className="label">Serviços que executa</legend>
            {services.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum serviço cadastrado ainda.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {services.map((s) => (
                  <label key={s.id} className={`flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm ${s.active ? "" : "opacity-60"}`}>
                    <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={s.checked} className="h-4 w-4 rounded border-zinc-300" />
                    {s.name}
                    {!s.active && <span className="ml-auto text-xs text-zinc-400">inativo</span>}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </>
      )}

      <SubmitButton>Salvar perfil</SubmitButton>
    </form>
  );
}

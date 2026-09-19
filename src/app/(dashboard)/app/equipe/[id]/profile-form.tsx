"use client";

import { useActionState } from "react";
import { updateProfessionalAction } from "@/actions/professionals";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

type Props = {
  id: string;
  canManage: boolean;
  initial: { name: string; bio: string; photoUrl: string; phone: string; email: string; specialties: string; commissionPercent: number | null; active: boolean };
  services: { id: string; name: string; active: boolean; checked: boolean; commissionPercent: number | null }[];
};

export function ProfileForm({ id, canManage, initial, services }: Props) {
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="specialties">Especialidades</label>
          <input id="specialties" name="specialties" className="input" defaultValue={initial.specialties} placeholder="Corte, coloração, mechas" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Telefone</label>
          <input id="phone" name="phone" inputMode="tel" className="input" defaultValue={initial.phone} placeholder="(11) 99999-8888" />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" className="input" defaultValue={initial.email} />
        </div>
      </div>

      {canManage && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4 rounded border-zinc-300" />
            Ativo (aparece na página pública e recebe agendamentos)
          </label>

          <div className="max-w-xs">
            <label className="label" htmlFor="commissionPercent">Comissão padrão (%)</label>
            <input id="commissionPercent" name="commissionPercent" type="number" min={0} max={100} step={1} className="input" defaultValue={initial.commissionPercent ?? ""} placeholder="vazio = não comissionado" />
            <p className="mt-1 text-xs text-zinc-500">Apurada sobre o valor de cada serviço (com adicionais) quando a visita é concluída.</p>
          </div>

          <fieldset>
            <legend className="label">Serviços que executa <span className="font-normal text-zinc-400">· comissão específica em % (vazio = usa a padrão)</span></legend>
            {services.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum serviço cadastrado ainda.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {services.map((s) => (
                  <label key={s.id} className={`flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm ${s.active ? "" : "opacity-60"}`}>
                    <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={s.checked} className="h-4 w-4 rounded border-zinc-300" />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {!s.active && <span className="text-xs text-zinc-400">inativo</span>}
                    <input
                      type="number" name={`commission_${s.id}`} min={0} max={100} step={1}
                      defaultValue={s.commissionPercent ?? ""} placeholder="%" aria-label={`Comissão em ${s.name}`}
                      className="w-16 rounded-md border border-zinc-200 px-2 py-1 text-right text-xs"
                    />
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

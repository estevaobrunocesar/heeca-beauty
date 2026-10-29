"use client";

import { useActionState } from "react";
import { updateClientAction } from "@/actions/clients";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import type { CampoFicha } from "@/lib/marca";
import { FichaCampos } from "@/components/ficha-campos";

type Values = {
  name: string; phone: string; email: string; notes: string;
  ficha: Record<string, string>; allergies: string; maintenanceIntervalDays: number | null; preferredProfessionalIds: string[];
};

/** Ficha da cliente: contato + ficha técnica dos segmentos ativos (lib/marca.ts) que a profissional consulta antes do atendimento. */
export function ClientForm({ id, initial, campos, grupos, requirePhone, professionals }: { id: string; initial: Values; campos: CampoFicha[]; grupos: Record<string, string>; requirePhone: boolean; professionals: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionResult, FormData>(updateClientAction.bind(null, id), null);
  return (
    <form action={action} className="card space-y-3 p-5">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div><label className="label" htmlFor="name">Nome</label><input id="name" name="name" required className="input" defaultValue={initial.name} /></div>
      <div><label className="label" htmlFor="phone">WhatsApp{requirePhone ? "" : " (opcional)"}</label><input id="phone" name="phone" required={requirePhone} className="input" defaultValue={initial.phone} /></div>
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" defaultValue={initial.email} /></div>

      <fieldset>
        <legend className="label">Profissionais de preferência</legend>
        <div className="flex flex-wrap gap-2">
          {professionals.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="checkbox" name="preferredProfessionalIds" value={p.id} defaultChecked={initial.preferredProfessionalIds.includes(p.id)} className="h-4 w-4 rounded border-zinc-300" />
              {p.name}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-zinc-500">Marque uma ou mais. Sem nenhuma marcada, a cliente não tem preferência.</p>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Ficha técnica</legend>
        <FichaCampos campos={campos} grupos={grupos} valores={initial.ficha} />
        <div>
          <label className="label" htmlFor="allergies">Alergias / produtos a evitar</label>
          <input id="allergies" name="allergies" className="input" defaultValue={initial.allergies} placeholder="Ex.: sensibilidade ao primer ácido" />
        </div>
        <div>
          <label className="label" htmlFor="maintenanceIntervalDays">Ciclo de manutenção</label>
          <select id="maintenanceIntervalDays" name="maintenanceIntervalDays" className="input" defaultValue={initial.maintenanceIntervalDays ?? 0}>
            <option value={0}>Não definido (usa a média do histórico)</option>
            {[14, 15, 18, 20, 21, 25, 28, 30, 35, 40, 45].map((d) => <option key={d} value={d}>a cada {d} dias</option>)}
          </select>
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="notes">Observações internas</label>
        <textarea id="notes" name="notes" rows={3} className="input" defaultValue={initial.notes} placeholder="Preferências, como gosta de ser atendida, costuma atrasar 10 min..." />
      </div>
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}

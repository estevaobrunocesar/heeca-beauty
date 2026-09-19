"use client";

import { useActionState } from "react";
import { updateClientAction } from "@/actions/clients";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

type Values = {
  name: string; phone: string; email: string; notes: string;
  nailShape: string; nailSize: string; allergies: string; maintenanceIntervalDays: number | null;
};

const SHAPES = ["Almond", "Quadrado", "Quadrado arredondado", "Oval", "Stiletto", "Bailarina", "Redondo", "Squoval"];
const SIZES = ["Curto", "Médio", "Longo", "Extra longo"];

/** Ficha da cliente (seção 11): contato + preferências técnicas que a profissional consulta antes do atendimento. */
export function ClientForm({ id, initial }: { id: string; initial: Values }) {
  const [state, action] = useActionState<ActionResult, FormData>(updateClientAction.bind(null, id), null);
  return (
    <form action={action} className="card space-y-3 p-5">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div><label className="label" htmlFor="name">Nome</label><input id="name" name="name" required className="input" defaultValue={initial.name} /></div>
      <div><label className="label" htmlFor="phone">WhatsApp</label><input id="phone" name="phone" required className="input" defaultValue={initial.phone} /></div>
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" defaultValue={initial.email} /></div>

      <fieldset className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Ficha técnica</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="nailShape">Formato</label>
            <input id="nailShape" name="nailShape" list="nail-shapes" className="input" defaultValue={initial.nailShape} placeholder="Almond" />
            <datalist id="nail-shapes">{SHAPES.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label className="label" htmlFor="nailSize">Tamanho</label>
            <input id="nailSize" name="nailSize" list="nail-sizes" className="input" defaultValue={initial.nailSize} placeholder="Médio" />
            <datalist id="nail-sizes">{SIZES.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        </div>
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
        <textarea id="notes" name="notes" rows={3} className="input" defaultValue={initial.notes} placeholder="Prefere esmaltação nude, gosta de francesinha fina, costuma atrasar 10 min..." />
      </div>
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}

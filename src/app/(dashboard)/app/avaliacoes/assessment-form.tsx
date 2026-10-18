"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAssessmentAction } from "@/actions/treatments";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

export type AssessmentValues = {
  id?: string; clientId?: string; professionalId?: string; performedAt?: string;
  complaints?: string | null; analysis?: string | null; notes?: string | null;
  recommendedProtocolId?: string | null; suggestedSessions?: number | null; serviceIds?: string[];
};

type Props = {
  initial?: AssessmentValues;
  clients: { id: string; label: string }[];
  professionals: { id: string; name: string }[];
  protocols: { id: string; name: string; sessions: number }[];
  services: { id: string; name: string }[];
  /** Profissional travado (perfil sem gestão só registra em nome próprio). */
  lockedProfessionalId?: string;
  today: string;
};

/** Avaliação inicial: queixa, achados, serviços e protocolo recomendados — base do plano de tratamento. */
export function AssessmentForm({ initial, clients, professionals, protocols, services, lockedProfessionalId, today }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult, FormData>(saveAssessmentAction.bind(null, initial?.id ?? null), null);
  const [protocolId, setProtocolId] = useState(initial?.recommendedProtocolId ?? "");
  const proto = protocols.find((p) => p.id === protocolId);
  return (
    <form action={formAction} className="card max-w-2xl space-y-4 p-6">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="clientId">Cliente</label>
          <select id="clientId" name="clientId" required className="input" defaultValue={initial?.clientId ?? ""}>
            <option value="">Escolha…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="performedAt">Data da avaliação</label>
          <input id="performedAt" name="performedAt" type="date" required className="input" defaultValue={initial?.performedAt ?? today} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="professionalId">Profissional</label>
        <select id="professionalId" name="professionalId" required className="input" defaultValue={lockedProfessionalId ?? initial?.professionalId ?? ""} disabled={!!lockedProfessionalId && professionals.length <= 1}>
          {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {lockedProfessionalId && professionals.length <= 1 && <input type="hidden" name="professionalId" value={lockedProfessionalId} />}
      </div>
      <div>
        <label className="label" htmlFor="complaints">Queixa principal</label>
        <textarea id="complaints" name="complaints" rows={2} maxLength={600} className="input" defaultValue={initial?.complaints ?? ""} placeholder="O que a cliente quer tratar" />
      </div>
      <div>
        <label className="label" htmlFor="analysis">Achados da avaliação</label>
        <textarea id="analysis" name="analysis" rows={3} maxLength={1000} className="input" defaultValue={initial?.analysis ?? ""} placeholder="Tipo de pele, lesões, sensibilidade, contraindicações…" />
      </div>
      <fieldset>
        <legend className="label">Serviços indicados</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm">
              <input type="checkbox" name="serviceId" value={s.id} defaultChecked={initial?.serviceIds?.includes(s.id)} className="h-4 w-4 rounded border-zinc-300" />
              <span className="min-w-0 truncate">{s.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <div>
          <label className="label" htmlFor="recommendedProtocolId">Protocolo recomendado <span className="font-normal text-zinc-400">(opcional)</span></label>
          <select id="recommendedProtocolId" name="recommendedProtocolId" className="input" value={protocolId} onChange={(e) => setProtocolId(e.target.value)}>
            <option value="">—</option>
            {protocols.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="suggestedSessions">Sessões sugeridas</label>
          <input id="suggestedSessions" name="suggestedSessions" type="number" min={1} max={200} className="input" key={protocolId} defaultValue={initial?.suggestedSessions ?? proto?.sessions ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">Observações <span className="font-normal text-zinc-400">(opcional)</span></label>
        <textarea id="notes" name="notes" rows={2} maxLength={600} className="input" defaultValue={initial?.notes ?? ""} />
      </div>
      <div className="flex gap-2 pt-2">
        <SubmitButton>{initial?.id ? "Salvar avaliação" : "Registrar avaliação"}</SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancelar</button>
      </div>
    </form>
  );
}

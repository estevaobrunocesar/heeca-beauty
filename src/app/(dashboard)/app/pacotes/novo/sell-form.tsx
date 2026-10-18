"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { sellPackageAction } from "@/actions/packages";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

type Pkg = { id: string; label: string; price: string };
type Proto = { id: string; label: string; sessions: number };

type Props = {
  packages: Pkg[];
  /** Protocolos para plano avulso (módulo clínico); vazio fora do segmento Estética. */
  protocols: Proto[];
  clients: { id: string; label: string }[];
  professionals: { id: string; name: string }[];
  defaultClientId?: string;
  defaultSource?: string;
  defaultSessions?: number;
  defaultProfessionalId?: string;
  assessmentId?: string;
  today: string;
};

export function SellForm({ packages, protocols, clients, professionals, defaultClientId, defaultSource, defaultSessions, defaultProfessionalId, assessmentId, today }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult, FormData>(sellPackageAction, null);
  const first = packages[0] ? `package:${packages[0].id}` : protocols[0] ? `protocol:${protocols[0].id}` : "";
  const [source, setSource] = useState(defaultSource ?? first);
  const [kind, id] = source.split(":");
  const pkg = kind === "package" ? packages.find((p) => p.id === id) : undefined;
  const proto = kind === "protocol" ? protocols.find((p) => p.id === id) : undefined;
  return (
    <form action={formAction} className="card max-w-xl space-y-4 p-6">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      {assessmentId && <input type="hidden" name="assessmentId" value={assessmentId} />}
      <div>
        <label className="label" htmlFor="clientId">Cliente</label>
        <select id="clientId" name="clientId" required className="input" defaultValue={defaultClientId ?? ""}>
          <option value="">Escolha…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="source">{protocols.length ? "Pacote ou protocolo" : "Pacote"}</label>
        <select id="source" name="source" required className="input" value={source} onChange={(e) => setSource(e.target.value)}>
          {packages.length > 0 && (
            <optgroup label="Pacotes do catálogo">
              {packages.map((p) => <option key={p.id} value={`package:${p.id}`}>{p.label}</option>)}
            </optgroup>
          )}
          {protocols.length > 0 && (
            <optgroup label="Protocolos (plano avulso)">
              {protocols.map((p) => <option key={p.id} value={`protocol:${p.id}`}>{p.label}</option>)}
            </optgroup>
          )}
        </select>
      </div>
      {professionals.length > 0 && (
        <div>
          <label className="label" htmlFor="professionalId">Profissional de referência <span className="font-normal text-zinc-400">(opcional)</span></label>
          <select id="professionalId" name="professionalId" className="input" defaultValue={defaultProfessionalId ?? ""}>
            <option value="">—</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Quem acompanha o plano; as sessões podem ser feitas por outra pessoa.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="startsAt">Início da validade</label>
          <input id="startsAt" name="startsAt" type="date" required className="input" defaultValue={today} />
        </div>
        <div>
          <label className="label" htmlFor="price">Valor cobrado (R$)</label>
          <input id="price" name="price" inputMode="decimal" className="input" key={source} required={kind === "protocol"} defaultValue={pkg?.price ?? ""} />
          <p className="mt-1 text-xs text-zinc-500">{kind === "protocol" ? "Obrigatório no plano avulso." : "Pode dar desconto aqui; o catálogo não muda."}</p>
        </div>
      </div>
      {kind === "protocol" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="sessionsTotal">Sessões contratadas</label>
            <input id="sessionsTotal" name="sessionsTotal" type="number" min={1} max={200} required className="input" key={`s-${source}-${defaultSessions ?? ""}`} defaultValue={defaultSessions ?? proto?.sessions ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="validityDays">Validade (dias)</label>
            <input id="validityDays" name="validityDays" type="number" min={0} max={3650} className="input" placeholder="sem validade" />
          </div>
        </div>
      )}
      <div>
        <label className="label" htmlFor="notes">Observações (opcional)</label>
        <input id="notes" name="notes" maxLength={300} className="input" placeholder="Ex.: pago em 2x no cartão" />
      </div>
      <div className="flex gap-2 pt-2">
        <SubmitButton pendingText="Registrando...">Registrar venda</SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancelar</button>
      </div>
    </form>
  );
}

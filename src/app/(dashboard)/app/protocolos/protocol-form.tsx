"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProtocolAction } from "@/actions/treatments";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

type Svc = { id: string; name: string; durationMinutes: number };
type Step = { key: number; serviceId: string; notes: string };
export type ProtocolValues = {
  id?: string; name?: string; objective?: string | null; sessionsCount?: number; intervalDays?: number | null;
  products?: string | null; notes?: string | null; active?: boolean; steps?: { serviceId: string; notes: string | null }[];
};

/** Protocolo: receita de tratamento — etapas ordenadas de serviços do catálogo, sessões e intervalo sugeridos. */
export function ProtocolForm({ initial, services }: { initial?: ProtocolValues; services: Svc[] }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult, FormData>(saveProtocolAction.bind(null, initial?.id ?? null), null);
  const [steps, setSteps] = useState<Step[]>(() =>
    (initial?.steps?.length ? initial.steps : [{ serviceId: services[0]?.id ?? "", notes: "" }]).map((s, i) => ({ key: i + 1, serviceId: s.serviceId, notes: s.notes ?? "" })),
  );
  const [nextKey, setNextKey] = useState(steps.length + 1);
  useEffect(() => { if (state?.ok) router.push("/app/protocolos"); }, [state, router]);

  const move = (i: number, d: -1 | 1) => setSteps((l) => { const j = i + d; if (j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const update = (key: number, patch: Partial<Step>) => setSteps((l) => l.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  if (services.length === 0) return <Alert>Cadastre ao menos um serviço ativo antes de montar um protocolo.</Alert>;

  return (
    <form action={formAction} className="card max-w-2xl space-y-4 p-6">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div>
        <label className="label" htmlFor="name">Nome do protocolo</label>
        <input id="name" name="name" required maxLength={80} className="input" defaultValue={initial?.name ?? ""} placeholder="Detox facial" />
      </div>
      <div>
        <label className="label" htmlFor="objective">Objetivo <span className="font-normal text-zinc-400">(opcional)</span></label>
        <input id="objective" name="objective" maxLength={200} className="input" defaultValue={initial?.objective ?? ""} placeholder="Reduzir oleosidade e cravos" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="sessionsCount">Sessões sugeridas</label>
          <input id="sessionsCount" name="sessionsCount" type="number" min={1} max={200} required className="input" defaultValue={initial?.sessionsCount ?? 6} />
        </div>
        <div>
          <label className="label" htmlFor="intervalDays">Intervalo entre sessões (dias)</label>
          <input id="intervalDays" name="intervalDays" type="number" min={0} max={365} className="input" defaultValue={initial?.intervalDays ?? 15} />
        </div>
      </div>

      <fieldset>
        <legend className="label">Etapas <span className="font-normal text-zinc-400">· cada etapa é um serviço do catálogo; a ordem é uma sugestão</span></legend>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={s.key} className="rounded-lg border border-zinc-200 p-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 text-sm text-zinc-400">{i + 1}.</span>
                <select name="stepServiceId" className="input min-w-0 flex-1" value={s.serviceId} onChange={(e) => update(s.key, { serviceId: e.target.value })} aria-label={`Serviço da etapa ${i + 1}`}>
                  {services.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.durationMinutes} min</option>)}
                </select>
                <button type="button" className="btn-ghost px-2 py-1" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir etapa">↑</button>
                <button type="button" className="btn-ghost px-2 py-1" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Descer etapa">↓</button>
                <button type="button" className="btn-ghost px-2 py-1 text-rose-600" disabled={steps.length === 1} onClick={() => setSteps((l) => l.filter((x) => x.key !== s.key))} aria-label="Remover etapa">×</button>
              </div>
              <input name="stepNotes" maxLength={300} className="input mt-2" value={s.notes} onChange={(e) => update(s.key, { notes: e.target.value })} placeholder="Orientação desta etapa (opcional)" aria-label={`Orientação da etapa ${i + 1}`} />
            </div>
          ))}
        </div>
        {steps.length < 12 && (
          <button type="button" className="btn-secondary mt-2" onClick={() => { setSteps((l) => [...l, { key: nextKey, serviceId: services[0].id, notes: "" }]); setNextKey((k) => k + 1); }}>+ Adicionar etapa</button>
        )}
      </fieldset>

      <div>
        <label className="label" htmlFor="products">Produtos e ativos <span className="font-normal text-zinc-400">(opcional)</span></label>
        <input id="products" name="products" maxLength={300} className="input" defaultValue={initial?.products ?? ""} placeholder="Ácido salicílico 2%, argila verde…" />
      </div>
      <div>
        <label className="label" htmlFor="notes">Observações <span className="font-normal text-zinc-400">(opcional)</span></label>
        <textarea id="notes" name="notes" rows={2} maxLength={500} className="input" defaultValue={initial?.notes ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="h-4 w-4 rounded border-zinc-300" />
        Ativo (disponível para venda e recomendação)
      </label>
      <div className="flex gap-2 pt-2">
        <SubmitButton>{initial?.id ? "Salvar protocolo" : "Criar protocolo"}</SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancelar</button>
      </div>
    </form>
  );
}

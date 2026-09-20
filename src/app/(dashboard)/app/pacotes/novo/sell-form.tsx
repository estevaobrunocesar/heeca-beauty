"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { sellPackageAction } from "@/actions/packages";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

type Pkg = { id: string; label: string; price: string };

export function SellForm({ packages, clients, defaultClientId, today }: { packages: Pkg[]; clients: { id: string; label: string }[]; defaultClientId?: string; today: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult, FormData>(sellPackageAction, null);
  const [pkgId, setPkgId] = useState(packages[0]?.id ?? "");
  const pkg = packages.find((p) => p.id === pkgId);
  return (
    <form action={formAction} className="card max-w-xl space-y-4 p-6">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div>
        <label className="label" htmlFor="clientId">Cliente</label>
        <select id="clientId" name="clientId" required className="input" defaultValue={defaultClientId ?? ""}>
          <option value="">Escolha…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="packageId">Pacote</label>
        <select id="packageId" name="packageId" required className="input" value={pkgId} onChange={(e) => setPkgId(e.target.value)}>
          {packages.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="startsAt">Início da validade</label>
          <input id="startsAt" name="startsAt" type="date" required className="input" defaultValue={today} />
        </div>
        <div>
          <label className="label" htmlFor="price">Valor cobrado (R$)</label>
          <input id="price" name="price" inputMode="decimal" className="input" key={pkgId} defaultValue={pkg?.price ?? ""} />
          <p className="mt-1 text-xs text-zinc-500">Pode dar desconto aqui; o catálogo não muda.</p>
        </div>
      </div>
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

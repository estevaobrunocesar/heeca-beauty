"use client";

import { useActionState } from "react";
import { setCashbackPercentAction } from "@/actions/loyalty";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { MAX_PERCENT } from "@/lib/loyalty/rules";

/** Programa de fidelidade por cashback: um percentual (0 desliga). */
export function LoyaltyForm({ initialPercent, canManage }: { initialPercent: number; canManage: boolean }) {
  const [state, action] = useActionState<ActionResult, FormData>(setCashbackPercentAction, null);
  return (
    <form action={action} className="card space-y-4 p-6">
      <div>
        <h2 className="font-medium">Cashback para clientes fiéis</h2>
        <p className="text-sm text-zinc-500">Devolva uma parte do que a cliente gasta em serviços para ela usar nos próximos atendimentos.</p>
      </div>
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div className="max-w-xs">
        <label className="label" htmlFor="percent">Cashback por atendimento (%)</label>
        <input id="percent" name="percent" type="number" min={0} max={MAX_PERCENT} step={1} defaultValue={initialPercent} className="input" disabled={!canManage} />
        <p className="mt-1 text-xs text-zinc-500">0 = desligado. Máximo de {MAX_PERCENT}%. Ex.: 5% em um serviço de R$ 100,00 devolve R$ 5,00.</p>
      </div>
      {canManage && <SubmitButton>Salvar</SubmitButton>}
    </form>
  );
}

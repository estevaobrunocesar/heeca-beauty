"use client";

import { useActionState } from "react";
import { cashMovementAction, closeCashAction, openCashAction } from "@/actions/finance";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

const Msg = ({ state }: { state: ActionResult }) =>
  state ? <Alert kind={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Alert> : null;

export function OpenCashForm() {
  const [state, action] = useActionState<ActionResult, FormData>(openCashAction, null);
  return (
    <form action={action} className="space-y-3">
      <div className="max-w-xs">
        <label className="label" htmlFor="opening">Troco inicial na gaveta (R$)</label>
        <input id="opening" name="opening" inputMode="decimal" className="input" placeholder="0,00" />
      </div>
      <SubmitButton pendingText="Abrindo...">Abrir caixa</SubmitButton>
      <Msg state={state} />
    </form>
  );
}

export function CashMovementForm() {
  const [state, action] = useActionState<ActionResult, FormData>(cashMovementAction, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]">
      <select name="kind" className="input" defaultValue="WITHDRAWAL" aria-label="Tipo">
        <option value="WITHDRAWAL">Sangria (retirar)</option>
        <option value="SUPPLY">Suprimento (colocar)</option>
      </select>
      <input name="amount" required inputMode="decimal" className="input w-32" placeholder="Valor" aria-label="Valor" />
      <input name="note" maxLength={200} className="input" placeholder="Motivo (opcional)" aria-label="Motivo" />
      <SubmitButton pendingText="...">Lançar</SubmitButton>
      <div className="sm:col-span-4"><Msg state={state} /></div>
    </form>
  );
}

export function CloseCashForm({ esperadoLabel }: { esperadoLabel: string }) {
  const [state, action] = useActionState<ActionResult, FormData>(closeCashAction, null);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-zinc-600">Conte o dinheiro da gaveta. O sistema espera <strong>{esperadoLabel}</strong>.</p>
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
        <div><label className="label" htmlFor="counted">Dinheiro contado (R$)</label><input id="counted" name="counted" required inputMode="decimal" className="input" placeholder="0,00" /></div>
        <div><label className="label" htmlFor="close-note">Observação</label><input id="close-note" name="note" maxLength={300} className="input" placeholder="Opcional" /></div>
      </div>
      <SubmitButton pendingText="Fechando..." className="btn-secondary">Fechar caixa</SubmitButton>
      <Msg state={state} />
    </form>
  );
}

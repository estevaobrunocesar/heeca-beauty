"use client";

import { useActionState, useState, useTransition } from "react";
import { addPlanPaymentAction, removePlanPaymentAction, saveSessionEvolutionAction } from "@/actions/treatments";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { FORMAS_PAGAMENTO, ROTULO_FORMA } from "@/lib/treatments/rules";

export type PaymentRow = { id: string; amountLabel: string; method: keyof typeof ROTULO_FORMA; dateLabel: string; notes: string | null };

/** Recebimentos do plano: lista + registrar (à vista ou em parcelas, qualquer forma). */
export function PaymentsCard({ clientPackageId, payments, today, resumo }: {
  clientPackageId: string; payments: PaymentRow[]; today: string;
  resumo: { pago: string; saldo: string; excedente: string | null; quitado: boolean; progresso: number };
}) {
  const [state, action] = useActionState<ActionResult, FormData>(addPlanPaymentAction.bind(null, clientPackageId), null);
  const [pending, start] = useTransition();
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">Recebimentos</h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${resumo.quitado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{resumo.quitado ? "Quitado" : `Falta ${resumo.saldo}`}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-100"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, resumo.progresso)}%` }} /></div>
      <p className="mt-1 text-xs text-zinc-500">Recebido {resumo.pago}{resumo.excedente ? ` · ${resumo.excedente} acima do valor do plano` : ""}</p>
      {payments.length > 0 && (
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0 truncate">{p.dateLabel} · {ROTULO_FORMA[p.method]}{p.notes ? ` · ${p.notes}` : ""}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums">{p.amountLabel}</span>
                <button type="button" aria-label="Remover recebimento" disabled={pending} className="text-xs text-rose-600 hover:underline" onClick={() => { if (confirm("Remover este recebimento?")) start(() => removePlanPaymentAction(p.id)); }}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
        {state && <Alert kind={state.ok ? "success" : undefined}>{state.ok ? state.message : state.error}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          <input name="amount" required inputMode="decimal" className="input" placeholder="Valor (R$)" aria-label="Valor" />
          <select name="method" className="input" aria-label="Forma de pagamento" defaultValue="PIX">
            {FORMAS_PAGAMENTO.map((m) => <option key={m} value={m}>{ROTULO_FORMA[m]}</option>)}
          </select>
          <input name="paidAt" type="date" required defaultValue={today} className="input" aria-label="Data" />
          <input name="notes" maxLength={200} className="input" placeholder="Obs. (ex.: parcela 1/3)" aria-label="Observação" />
        </div>
        <SubmitButton pendingText="Registrando...">Registrar recebimento</SubmitButton>
      </form>
    </div>
  );
}

/** Evolução da sessão: produtos aplicados e anotações do profissional. Recolhido por padrão; ponto marca quem já tem nota. */
export function SessionEvolution({ sessionId, productsUsed, evolution }: { sessionId: string; productsUsed: string | null; evolution: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult, FormData>(saveSessionEvolutionAction.bind(null, sessionId), null);
  const has = !!(productsUsed || evolution);
  return (
    <div className="w-full">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-brand-700 hover:underline" aria-expanded={open}>
        {open ? "Fechar evolução" : has ? "Ver evolução ●" : "Anotar evolução"}
      </button>
      {open && (
        <form action={action} className="mt-2 space-y-2">
          {state && <Alert kind={state.ok ? "success" : undefined}>{state.ok ? state.message : state.error}</Alert>}
          <input name="productsUsed" maxLength={300} defaultValue={productsUsed ?? ""} className="input" placeholder="Produtos/ativos aplicados" aria-label="Produtos aplicados" />
          <textarea name="evolution" rows={3} maxLength={1500} defaultValue={evolution ?? ""} className="input" placeholder="Evolução observada: resposta da pele, reações, orientações dadas…" aria-label="Evolução" />
          <SubmitButton pendingText="Salvando...">Salvar</SubmitButton>
        </form>
      )}
    </div>
  );
}

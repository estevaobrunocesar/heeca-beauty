"use client";

import { useActionState, useState, useTransition } from "react";
import { addExpenseAction, deleteExpenseAction } from "@/actions/finance";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/action-result";
import { formatCents } from "@/lib/money";
import { EXPENSE_CATEGORIES, METHODS, METHOD_LABEL, type Method } from "@/lib/finance/rules";

export type ExpenseRow = { id: string; description: string; category: string; cents: number; method: Method; day: string; notes: string | null };

const br = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

/** Lista das despesas do período + formulário para lançar uma nova. */
export function ExpensesManager({ expenses, today }: { expenses: ExpenseRow[]; today: string }) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await addExpenseAction(prev, fd);
    if (r?.ok) setAberto(false);
    return r;
  }, null);
  const [pending, start] = useTransition();

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div>
          <h2 className="font-medium">Despesas <span className="font-normal text-zinc-400">({expenses.length})</span></h2>
          <p className="text-xs text-zinc-500">Aluguel, produtos, equipe, impostos… Despesa em dinheiro, com o caixa aberto, sai da gaveta.</p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={() => setAberto((v) => !v)}>{aberto ? "Fechar" : "+ Lançar despesa"}</button>
      </div>

      {aberto && (
        <form action={formAction} className="grid gap-2 border-b border-zinc-100 bg-zinc-50/60 px-4 py-3 sm:grid-cols-6">
          <div className="sm:col-span-3"><label className="label" htmlFor="e-desc">Descrição</label><input id="e-desc" name="description" required maxLength={120} className="input" placeholder="Ex.: Aluguel de outubro" autoFocus /></div>
          <div className="sm:col-span-3"><label className="label" htmlFor="e-cat">Categoria</label>
            <select id="e-cat" name="category" className="input" defaultValue={EXPENSE_CATEGORIES[0]}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="e-amount">Valor (R$)</label><input id="e-amount" name="amount" required inputMode="decimal" className="input" placeholder="0,00" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="e-method">Pago com</label>
            <select id="e-method" name="method" className="input" defaultValue="PIX">{METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="e-day">Data</label><input id="e-day" name="day" type="date" required max={today} defaultValue={today} className="input" /></div>
          <div className="sm:col-span-6"><label className="label" htmlFor="e-notes">Observação</label><input id="e-notes" name="notes" maxLength={300} className="input" placeholder="Opcional" /></div>
          <div className="flex items-center gap-3 sm:col-span-6">
            <SubmitButton>Lançar despesa</SubmitButton>
            {state && !state.ok && <span className="text-sm text-rose-600">{state.error}</span>}
          </div>
        </form>
      )}

      {expenses.length === 0 ? <p className="px-4 py-8 text-center text-sm text-zinc-500">Nenhuma despesa neste período.</p> : (
        <ul className="divide-y divide-zinc-100">
          {expenses.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <div className="min-w-44 flex-1">
                <p className="text-sm font-medium">{e.description}</p>
                <p className="text-xs text-zinc-500">{br(e.day)} · {e.category} · {METHOD_LABEL[e.method]}{e.notes ? ` · ${e.notes}` : ""}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-rose-700">− {formatCents(e.cents)}</span>
              <button type="button" className="btn-ghost px-2 py-1 text-xs text-rose-600" disabled={pending}
                onClick={() => { if (confirm(`Remover a despesa "${e.description}"?`)) start(async () => { await deleteExpenseAction(e.id); }); }}>Remover</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

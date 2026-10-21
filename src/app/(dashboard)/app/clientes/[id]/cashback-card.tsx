"use client";

import { useActionState, useState } from "react";
import { adjustCashbackAction, redeemCashbackAction } from "@/actions/loyalty";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { formatCents } from "@/lib/money";

export type CashbackLine = { id: string; when: string; label: string; note: string | null; cents: number };

const TIPO: Record<string, string> = { EARN: "Cashback ganho", REVERSAL: "Estorno", REDEEM: "Usado", ADJUST: "Ajuste" };

/** Saldo de cashback da cliente, uso do saldo (recepção) e ajuste manual (gestão). */
export function CashbackCard({ clientId, saldoCents, percent, linhas, canAdjust }: { clientId: string; saldoCents: number; percent: number; linhas: CashbackLine[]; canAdjust: boolean }) {
  const [modo, setModo] = useState<"nada" | "usar" | "ajustar">("nada");
  const [usoState, usoAction] = useActionState<ActionResult, FormData>(async (p, fd) => { const r = await redeemCashbackAction(clientId, p, fd); if (r?.ok) setModo("nada"); return r; }, null);
  const [ajusteState, ajusteAction] = useActionState<ActionResult, FormData>(async (p, fd) => { const r = await adjustCashbackAction(clientId, p, fd); if (r?.ok) setModo("nada"); return r; }, null);

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Cashback</h2>
          <p className="text-2xl font-semibold tabular-nums">{formatCents(saldoCents)}</p>
          <p className="text-xs text-zinc-500">{percent > 0 ? `${percent}% dos serviços concluídos voltam como saldo` : "A fidelidade está desligada; o saldo existente continua valendo"}</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={saldoCents <= 0} onClick={() => setModo(modo === "usar" ? "nada" : "usar")}>Usar saldo</button>
          {canAdjust && <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setModo(modo === "ajustar" ? "nada" : "ajustar")}>Ajustar</button>}
        </div>
      </div>

      {modo === "usar" && (
        <form action={usoAction} className="mt-3 grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
          <input name="amount" required inputMode="decimal" className="input" placeholder="Valor (R$)" aria-label="Valor a usar" autoFocus />
          <input name="note" maxLength={200} className="input" placeholder="Observação (opcional)" aria-label="Observação" />
          <SubmitButton pendingText="...">Registrar uso</SubmitButton>
          {usoState && !usoState.ok && <div className="sm:col-span-3"><Alert>{usoState.error}</Alert></div>}
        </form>
      )}
      {modo === "ajustar" && (
        <form action={ajusteAction} className="mt-3 grid gap-2 sm:grid-cols-[9rem_9rem_1fr_auto]">
          <select name="sign" className="input" defaultValue="credit" aria-label="Tipo"><option value="credit">Dar bônus</option><option value="debit">Descontar</option></select>
          <input name="amount" required inputMode="decimal" className="input" placeholder="Valor (R$)" aria-label="Valor" />
          <input name="note" required minLength={3} maxLength={200} className="input" placeholder="Motivo do ajuste" aria-label="Motivo" />
          <SubmitButton pendingText="...">Ajustar</SubmitButton>
          {ajusteState && !ajusteState.ok && <div className="sm:col-span-4"><Alert>{ajusteState.error}</Alert></div>}
        </form>
      )}

      {linhas.length > 0 && (
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {linhas.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">{l.when} · {TIPO[l.label] ?? l.label}{l.note ? ` · ${l.note}` : ""}</span>
              <span className={`shrink-0 tabular-nums ${l.cents < 0 ? "text-rose-700" : "text-emerald-700"}`}>{l.cents > 0 ? "+" : "−"} {formatCents(Math.abs(l.cents))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

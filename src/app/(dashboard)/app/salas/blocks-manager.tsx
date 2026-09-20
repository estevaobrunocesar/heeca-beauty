"use client";

import { useActionState, useTransition } from "react";
import { createRoomBlockAction, deleteRoomBlockAction } from "@/actions/rooms";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

type Target = { value: string; label: string };
type BlockRow = { id: string; alvo: string; periodo: string; reason: string | null };

const HORAS = Array.from({ length: 24 * 4 }, (_, i) => i * 15);
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Bloqueios de sala/recurso (manutenção, limpeza pesada): nesse período o motor não os oferece. */
export function BlocksManager({ targets, blocks }: { targets: Target[]; blocks: BlockRow[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(createRoomBlockAction, null);
  const [pending, start] = useTransition();
  return (
    <section className="card">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="font-medium">Manutenção e bloqueios</h2>
        <p className="text-xs text-zinc-500">Sala em reforma, banheira em manutenção: bloqueie o período e o sistema não vende horários nela.</p>
      </div>
      <form action={formAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto_auto_auto_1fr_auto]">
        <select name="target" required className="input" disabled={targets.length === 0}>
          {targets.length === 0 ? <option value="">Cadastre uma sala ou recurso</option> : targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input name="date" type="date" required className="input" />
        <select name="startMinutes" defaultValue={9 * 60} className="input">{HORAS.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select>
        <select name="endMinutes" defaultValue={18 * 60} className="input">{HORAS.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}<option value={1440}>24:00</option></select>
        <input name="reason" maxLength={120} className="input" placeholder="Motivo (opcional)" />
        <SubmitButton disabled={targets.length === 0}>Bloquear</SubmitButton>
        {state?.ok && <div className="sm:col-span-6"><Alert kind="success">{state.message}</Alert></div>}
        {state && !state.ok && <div className="sm:col-span-6"><Alert>{state.error}</Alert></div>}
      </form>
      {blocks.length > 0 && (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center gap-2 px-4 py-2 text-sm">
              <span className="flex-1"><span className="font-medium">{b.alvo}</span> · {b.periodo}{b.reason && <span className="text-zinc-500"> · {b.reason}</span>}</span>
              <button className="btn-ghost px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" disabled={pending} onClick={() => { if (confirm("Remover este bloqueio?")) start(() => deleteRoomBlockAction(b.id)); }}>Remover</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

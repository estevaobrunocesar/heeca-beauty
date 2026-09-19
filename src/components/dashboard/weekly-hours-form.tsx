"use client";

import { useActionState, useState } from "react";
import { updateProfessionalHoursAction } from "@/actions/professionals";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { WEEKDAY_NAMES } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";

export type DayValue = { weekday: number; enabled: boolean; start: string; end: string; breakStart: string; breakEnd: string };

/** Horário semanal de um profissional (dias, início/fim e intervalo de almoço). */
export function WeeklyHoursForm({ professionalId, days }: { professionalId: string; days: DayValue[] }) {
  const [state, action] = useActionState<ActionResult, FormData>(updateProfessionalHoursAction.bind(null, professionalId), null);
  const [enabled, setEnabled] = useState(days.map((d) => d.enabled));
  // Começa na segunda-feira, como o brasileiro espera.
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((w) => days[w]);

  return (
    <form action={action} className="card p-6">
      {state?.ok && <div className="mb-4"><Alert kind="success">{state.message}</Alert></div>}
      {state && !state.ok && <div className="mb-4"><Alert>{state.error}</Alert></div>}
      <h2 className="font-medium">Dias e horários de atendimento</h2>
      <p className="mt-1 text-sm text-zinc-500">Deixe o almoço em branco se não houver intervalo.</p>
      <div className="mt-4 divide-y divide-zinc-100">
        {ordered.map((d) => (
          <div key={d.weekday} className="grid items-center gap-2 py-3 sm:grid-cols-[150px_1fr]">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name={`day_${d.weekday}_enabled`}
                checked={enabled[d.weekday]}
                onChange={(e) => setEnabled((prev) => prev.map((v, i) => (i === d.weekday ? e.target.checked : v)))}
                className="h-4 w-4 rounded border-zinc-300"
              />
              {WEEKDAY_NAMES[d.weekday]}
            </label>
            <div className={`flex flex-wrap items-center gap-2 text-sm ${enabled[d.weekday] ? "" : "pointer-events-none opacity-40"}`}>
              <input type="time" name={`day_${d.weekday}_start`} defaultValue={d.start} className="input w-28" />
              <span className="text-zinc-400">às</span>
              <input type="time" name={`day_${d.weekday}_end`} defaultValue={d.end} className="input w-28" />
              <span className="ml-2 text-zinc-500">almoço</span>
              <input type="time" name={`day_${d.weekday}_breakStart`} defaultValue={d.breakStart} className="input w-28" />
              <span className="text-zinc-400">às</span>
              <input type="time" name={`day_${d.weekday}_breakEnd`} defaultValue={d.breakEnd} className="input w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4"><SubmitButton>Salvar horários</SubmitButton></div>
    </form>
  );
}

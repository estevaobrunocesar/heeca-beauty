"use client";

import { useActionState } from "react";
import { updateScheduleAction } from "@/actions/settings";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

type Rules = {
  slotIntervalMinutes: number; bufferMinutes: number; minAdvanceMinutes: number; maxAdvanceDays: number;
  pendingExpiryMinutes: number; cancelDeadlineHours: number; reminderHoursBefore: number;
  maxConcurrentAppointments: number; maxDailyAppointments: number | null; requireWhatsappConfirmation: boolean;
};

/** Regras de agendamento do estabelecimento (valem para toda a equipe). */
export function ScheduleForm({ rules }: { rules: Rules }) {
  const [state, action] = useActionState(updateScheduleAction, null);

  return (
    <form action={action} className="space-y-6">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}

      <section className="card p-6">
        <h2 className="font-medium">Regras de agendamento</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Intervalo entre horários exibidos" hint="Ex.: 15 → 09:00, 09:15, 09:30...">
            <select name="slotIntervalMinutes" defaultValue={rules.slotIntervalMinutes} className="input">
              {[10, 15, 20, 30, 45, 60].map((v) => <option key={v} value={v}>{v} min</option>)}
            </select>
          </Field>
          <Field label="Tempo mínimo entre agendamentos" hint="Folga para limpeza/descanso entre clientes.">
            <select name="bufferMinutes" defaultValue={rules.bufferMinutes} className="input">
              {[0, 5, 10, 15, 20, 30].map((v) => <option key={v} value={v}>{v} min</option>)}
            </select>
          </Field>
          <Field label="Antecedência mínima" hint="Quanto tempo antes a cliente ainda pode marcar.">
            <select name="minAdvanceMinutes" defaultValue={rules.minAdvanceMinutes} className="input">
              {[0, 30, 60, 120, 180, 360, 720, 1440].map((v) => (
                <option key={v} value={v}>{v === 0 ? "Sem mínimo" : v < 60 ? `${v} min` : `${v / 60} h`}</option>
              ))}
            </select>
          </Field>
          <Field label="Agendar até (dias à frente)">
            <input type="number" name="maxAdvanceDays" min={1} max={365} defaultValue={rules.maxAdvanceDays} className="input" />
          </Field>
          <Field label="Liberar horário não confirmado após" hint="0 = nunca liberar automaticamente.">
            <select name="pendingExpiryMinutes" defaultValue={rules.pendingExpiryMinutes} className="input">
              {[0, 15, 30, 60, 120, 360, 720, 1440].map((v) => (
                <option key={v} value={v}>{v === 0 ? "Nunca" : v < 60 ? `${v} min` : `${v / 60} h`}</option>
              ))}
            </select>
          </Field>
          <Field label="Cliente pode cancelar até" hint="Horas antes do atendimento.">
            <select name="cancelDeadlineHours" defaultValue={rules.cancelDeadlineHours} className="input">
              {[0, 1, 2, 3, 6, 12, 24, 48].map((v) => <option key={v} value={v}>{v === 0 ? "A qualquer momento" : `${v} h antes`}</option>)}
            </select>
          </Field>
          <Field label="Lembrete por WhatsApp" hint="Enviado antes do horário.">
            <select name="reminderHoursBefore" defaultValue={rules.reminderHoursBefore} className="input">
              {[1, 2, 3, 6, 12, 24, 48].map((v) => <option key={v} value={v}>{v} h antes</option>)}
            </select>
          </Field>
          <Field label="Atendimentos simultâneos por profissional" hint="Normalmente 1.">
            <input type="number" name="maxConcurrentAppointments" min={1} max={20} defaultValue={rules.maxConcurrentAppointments} className="input" />
          </Field>
          <Field label="Limite de atendimentos por dia" hint="Por profissional. Deixe 0 para sem limite (ex.: no máximo 4 alongamentos por dia).">
            <input type="number" name="maxDailyAppointments" min={0} max={50} defaultValue={rules.maxDailyAppointments ?? 0} className="input" />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requireWhatsappConfirmation" defaultChecked={rules.requireWhatsappConfirmation} className="h-4 w-4 rounded border-zinc-300" />
              Exigir confirmação da cliente via WhatsApp
            </label>
          </div>
        </div>
      </section>

      <SubmitButton>Salvar regras</SubmitButton>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

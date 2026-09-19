"use client";

import { useActionState } from "react";
import { updatePoliciesAction } from "@/actions/settings";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

type Values = {
  lateToleranceMinutes: number; cancellationPolicy: string; reschedulePolicy: string; noShowPolicy: string;
  preServiceInstructions: string; companionsAllowed: boolean; requirePolicyAcceptance: boolean;
};

/** Políticas de atendimento (seção 14). Texto livre para as regras, número para a tolerância. */
export function PoliciesForm({ initial }: { initial: Values }) {
  const [state, action] = useActionState(updatePoliciesAction, null);
  return (
    <form action={action} className="card space-y-5 p-6">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lateToleranceMinutes">Tolerância de atraso</label>
          <select id="lateToleranceMinutes" name="lateToleranceMinutes" className="input" defaultValue={initial.lateToleranceMinutes}>
            <option value={0}>Não exibir</option>
            {[5, 10, 15, 20, 30].map((v) => <option key={v} value={v}>{v} minutos</option>)}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Após esse tempo, o atendimento pode ser cancelado conforme sua disponibilidade.</p>
        </div>
        <div className="space-y-3 pt-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="companionsAllowed" defaultChecked={initial.companionsAllowed} className="h-4 w-4 rounded border-zinc-300" />
            Permitir acompanhantes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requirePolicyAcceptance" defaultChecked={initial.requirePolicyAcceptance} className="h-4 w-4 rounded border-zinc-300" />
            Exigir que a cliente aceite as políticas ao agendar
          </label>
        </div>
      </div>

      <Text
        id="preServiceInstructions" label="Orientações pré-atendimento" value={initial.preServiceInstructions}
        hint="Enviadas automaticamente no WhatsApp de confirmação e no lembrete."
        placeholder="Para seu atendimento, pedimos que chegue alguns minutos antes do horário marcado e informe previamente caso precise realizar remoção de procedimento anterior."
      />
      <Text
        id="cancellationPolicy" label="Política de cancelamento" value={initial.cancellationPolicy}
        hint="Se vazio, usamos o prazo mínimo de cancelamento configurado em Horários e regras."
        placeholder="Cancelamentos com menos de 24h de antecedência podem ter o sinal retido."
      />
      <Text
        id="reschedulePolicy" label="Prazo para reagendamento" value={initial.reschedulePolicy}
        placeholder="Reagendamentos podem ser feitos até 12h antes do horário marcado, sujeitos à disponibilidade."
      />
      <Text
        id="noShowPolicy" label="Política para não comparecimento" value={initial.noShowPolicy}
        placeholder="Em caso de não comparecimento sem aviso, o sinal não é devolvido e novos agendamentos exigem pagamento antecipado."
      />

      <div className="pt-2">
        <SubmitButton>Salvar políticas</SubmitButton>
      </div>
    </form>
  );
}

function Text({ id, label, value, hint, placeholder }: { id: string; label: string; value: string; hint?: string; placeholder: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <textarea id={id} name={id} rows={2} maxLength={600} className="input" defaultValue={value} placeholder={placeholder} />
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

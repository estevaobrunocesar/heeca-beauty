"use client";

import { useActionState } from "react";
import { saveCampaignSettingsAction } from "@/actions/campaigns";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { DEFAULT_BIRTHDAY, DEFAULT_REACTIVATION, MAX_REACTIVATION_DAYS, MIN_REACTIVATION_DAYS } from "@/lib/campaigns/rules";

/** Textos das mensagens e a regra de "sem voltar há N dias". */
export function CampaignSettings({ birthdayMessage, reactivationMessage, reactivationDays }: { birthdayMessage: string; reactivationMessage: string; reactivationDays: number }) {
  const [state, action] = useActionState<ActionResult, FormData>(saveCampaignSettingsAction, null);
  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <h2 className="font-medium">Mensagens das campanhas</h2>
        <p className="text-sm text-zinc-500">Use <code>{"{nome}"}</code> (primeiro nome da cliente) e <code>{"{estabelecimento}"}</code>. Deixe em branco para usar o texto padrão.</p>
      </div>
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div>
        <label className="label" htmlFor="birthdayMessage">Aniversário</label>
        <textarea id="birthdayMessage" name="birthdayMessage" rows={3} maxLength={600} className="input" defaultValue={birthdayMessage} placeholder={DEFAULT_BIRTHDAY} />
      </div>
      <div>
        <label className="label" htmlFor="reactivationMessage">Reativação</label>
        <textarea id="reactivationMessage" name="reactivationMessage" rows={3} maxLength={600} className="input" defaultValue={reactivationMessage} placeholder={DEFAULT_REACTIVATION} />
      </div>
      <div className="max-w-xs">
        <label className="label" htmlFor="reactivationDays">Considerar “sem voltar” após (dias)</label>
        <input id="reactivationDays" name="reactivationDays" type="number" min={MIN_REACTIVATION_DAYS} max={MAX_REACTIVATION_DAYS} defaultValue={reactivationDays} className="input" />
      </div>
      <SubmitButton>Salvar mensagens</SubmitButton>
    </form>
  );
}

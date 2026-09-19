"use client";

import { useActionState } from "react";
import { updateTemplatesAction } from "@/actions/settings";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

export function TemplatesForm({ values, placeholders }: { values: { kind: string; label: string; body: string }[]; placeholders: string[] }) {
  const [state, action] = useActionState(updateTemplatesAction, null);
  return (
    <form action={action} className="card space-y-5 p-6">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div>
        <h2 className="font-medium">Modelos de mensagem</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Use os campos dinâmicos:{" "}
          {placeholders.map((p) => (
            <code key={p} className="mr-1 rounded bg-zinc-100 px-1 py-0.5 text-xs">{p}</code>
          ))}
        </p>
      </div>
      {values.map((v) => (
        <div key={v.kind}>
          <label className="label" htmlFor={v.kind}>{v.label}</label>
          <textarea id={v.kind} name={v.kind} rows={4} defaultValue={v.body} className="input font-mono text-xs" />
        </div>
      ))}
      <SubmitButton>Salvar mensagens</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { updateRecordAction } from "@/actions/appointments";
import { FichaCampos } from "@/components/ficha-campos";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import type { CampoFicha } from "@/lib/marca";

/**
 * Registro do atendimento: o que foi feito nesta visita, nos campos da ficha dos segmentos ativos.
 * Salvar também atualiza a ficha da cliente (campos vazios não apagam o que ela já tinha).
 */
export function RegistroForm({ id, campos, grupos, registro, fichaAtual }: { id: string; campos: CampoFicha[]; grupos: Record<string, string>; registro: Record<string, string>; fichaAtual: Record<string, string> }) {
  const [state, action] = useActionState<ActionResult, FormData>(updateRecordAction.bind(null, id), null);
  const preenchido = Object.keys(registro).length > 0;
  return (
    <form action={action} className="card space-y-3 p-5">
      <div>
        <h2 className="font-medium">Registro do atendimento</h2>
        <p className="text-xs text-zinc-500">{preenchido ? "O que foi feito nesta visita." : "Preencha depois do atendimento; os campos já vêm com a ficha atual da cliente."} Salvar atualiza a ficha dela.</p>
      </div>
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <FichaCampos campos={campos} grupos={grupos} valores={preenchido ? registro : fichaAtual} prefixoId="registro" />
      <SubmitButton>{preenchido ? "Atualizar registro" : "Salvar registro"}</SubmitButton>
    </form>
  );
}

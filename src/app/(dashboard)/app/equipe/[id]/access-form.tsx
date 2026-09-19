"use client";

import { useActionState, useState, useTransition } from "react";
import { removeProfessionalAccessAction, setProfessionalAccessAction } from "@/actions/professionals";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

type Role = "STAFF" | "RECEPTION" | "MANAGER";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "STAFF", label: "Profissional", hint: "vê e opera só a própria agenda, clientes e comissão" },
  { value: "RECEPTION", label: "Recepção", hint: "agenda e clientes de toda a equipe; não edita cadastros nem vê comissões" },
  { value: "MANAGER", label: "Gerente", hint: "gestão operacional e financeira (serviços, equipe, configurações, comissões); não gerencia acessos nem pagamentos" },
];

export function AccessForm({ id, email, hasAccess, isOwnerAccount, role }: { id: string; email: string; hasAccess: boolean; isOwnerAccount: boolean; role: Role }) {
  const [state, action] = useActionState<ActionResult, FormData>(setProfessionalAccessAction.bind(null, id), null);
  const [pending, start] = useTransition();
  const [removeMsg, setRemoveMsg] = useState<string | null>(null);

  if (isOwnerAccount) {
    return (
      <section className="card p-5 text-sm">
        <h2 className="font-medium">Acesso ao painel</h2>
        <p className="mt-1 text-zinc-600">Conta do responsável (<span className="font-medium">{email}</span>). Vê e gerencia toda a equipe.</p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <h2 className="font-medium">Acesso ao painel</h2>
      <p className="mt-1 text-sm text-zinc-500">O que esta pessoa pode fazer no painel depende do perfil escolhido.</p>
      <form action={action} className="mt-3 space-y-3">
        {state?.ok && <Alert kind="success">{state.message}</Alert>}
        {state && !state.ok && <Alert>{state.error}</Alert>}
        {removeMsg && <Alert kind="info">{removeMsg}</Alert>}
        <div>
          <label className="label" htmlFor="email">E-mail de login</label>
          <input id="email" name="email" type="email" required className="input" defaultValue={email} />
        </div>
        <fieldset>
          <legend className="label">Perfil</legend>
          <div className="space-y-1.5">
            {ROLES.map((r) => (
              <label key={r.value} className="flex items-start gap-2 text-sm">
                <input type="radio" name="role" value={r.value} defaultChecked={role === r.value} className="mt-1" />
                <span><span className="font-medium">{r.label}</span> <span className="text-zinc-500">· {r.hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="password">{hasAccess ? "Nova senha (deixe em branco para manter)" : "Senha inicial"}</label>
          <input id="password" name="password" type="password" minLength={8} className="input" autoComplete="new-password" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton>{hasAccess ? "Atualizar acesso" : "Criar acesso"}</SubmitButton>
          {hasAccess && (
            <button
              type="button"
              className="btn-danger"
              disabled={pending}
              onClick={() => {
                if (!confirm("Remover o acesso deste profissional ao painel?")) return;
                start(async () => {
                  const r = await removeProfessionalAccessAction(id);
                  setRemoveMsg(r?.ok ? "Acesso removido." : r?.error ?? "Erro");
                });
              }}
            >
              Remover acesso
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

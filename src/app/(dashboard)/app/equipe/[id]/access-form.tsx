"use client";

import { useActionState, useState, useTransition } from "react";
import { removeProfessionalAccessAction, setProfessionalAccessAction } from "@/actions/professionals";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { PERMISSIONS, ROLE_DEFAULTS, type PermissionKey } from "@/lib/permissions/rules";

type Role = "STAFF" | "RECEPTION" | "MANAGER";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "STAFF", label: "Profissional", hint: "vê e opera só a própria agenda, clientes e comissão" },
  { value: "RECEPTION", label: "Recepção", hint: "agenda e clientes de toda a equipe, caixa e campanhas" },
  { value: "MANAGER", label: "Gerente", hint: "todos os módulos de gestão; não gerencia acessos nem pagamentos" },
];

const GRUPOS = [...new Set(PERMISSIONS.map((p) => p.group))];

export function AccessForm({ id, email, hasAccess, isOwnerAccount, role: initialRole, marcadas }: { id: string; email: string; hasAccess: boolean; isOwnerAccount: boolean; role: Role; marcadas: PermissionKey[] }) {
  const [state, action] = useActionState<ActionResult, FormData>(setProfessionalAccessAction.bind(null, id), null);
  const [pending, start] = useTransition();
  const [removeMsg, setRemoveMsg] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(initialRole);
  const [checked, setChecked] = useState<Set<PermissionKey>>(() => new Set(marcadas));

  if (isOwnerAccount) {
    return (
      <section className="card p-5 text-sm">
        <h2 className="font-medium">Acesso ao painel</h2>
        <p className="mt-1 text-zinc-600">Conta do responsável (<span className="font-medium">{email}</span>). Vê e gerencia toda a equipe, com todas as permissões.</p>
      </section>
    );
  }

  // Ao trocar o perfil, as permissões voltam ao padrão dele (o dono ajusta de novo se quiser).
  const escolherPerfil = (r: Role) => { setRole(r); setChecked(new Set(ROLE_DEFAULTS[r])); };
  const alternar = (key: PermissionKey) => setChecked((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    if (key === "comissoes" && !n.has("comissoes")) n.delete("comissoes_acertar");
    if (key === "comissoes_acertar" && n.has("comissoes_acertar")) n.add("comissoes");
    return n;
  });

  return (
    <section className="card p-5">
      <h2 className="font-medium">Acesso ao painel</h2>
      <p className="mt-1 text-sm text-zinc-500">Escolha o perfil e, se precisar, ajuste o que esta pessoa pode abrir. Vale também fora do menu: quem não tem a permissão não consegue usar o módulo.</p>
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
                <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => escolherPerfil(r.value)} className="mt-1" />
                <span><span className="font-medium">{r.label}</span> <span className="text-zinc-500">· {r.hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">O que esta pessoa pode abrir</legend>
          <input type="hidden" name="permsSent" value="1" />
          <div className="space-y-3">
            {GRUPOS.map((g) => (
              <div key={g}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{g}</p>
                <div className="mt-1 space-y-1.5">
                  {PERMISSIONS.filter((p) => p.group === g).map((p) => {
                    const padrao = ROLE_DEFAULTS[role].has(p.key);
                    const on = checked.has(p.key);
                    return (
                      <label key={p.key} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" name={`perm_${p.key}`} checked={on} onChange={() => alternar(p.key)} className="mt-1 h-4 w-4 rounded border-zinc-300" />
                        <span>
                          <span className="font-medium">{p.label}</span>
                          {on !== padrao && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{on ? "extra" : "retirado"}</span>}
                          <span className="block text-xs text-zinc-500">{p.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
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

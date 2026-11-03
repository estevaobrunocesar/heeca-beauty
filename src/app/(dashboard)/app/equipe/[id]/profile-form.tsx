"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateProfessionalAction } from "@/actions/professionals";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { ImageField } from "@/components/ui/image-field";
import type { ActionResult } from "@/lib/action-result";

type Props = {
  id: string;
  canManage: boolean;
  initial: { name: string; bio: string; photoUrl: string; phone: string; email: string; specialties: string; active: boolean; unitId: string };
  units: { id: string; name: string }[];
  /** `agreement` = o que foi combinado com esta pessoa; `standardLabel` = a tabela padrão do serviço ("40%", "R$ 25,00" ou "—"). */
  services: { id: string; name: string; active: boolean; checked: boolean; agreement: { percent: number | null; fixedCents: number | null }; standardLabel: string }[];
};

export function ProfileForm({ id, canManage, initial, services, units }: Props) {
  const [state, action] = useActionState<ActionResult, FormData>(updateProfessionalAction.bind(null, id), null);
  return (
    <form action={action} className="card space-y-4 p-6">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Nome</label>
          <input id="name" name="name" required className="input" defaultValue={initial.name} />
        </div>
        <ImageField name="photoUrl" kind="professional" shape="circle" label="Foto" defaultValue={initial.photoUrl} hint="Aparece na página pública ao escolher o profissional." />
      </div>
      <div>
        <label className="label" htmlFor="bio">Descrição curta</label>
        <input id="bio" name="bio" className="input" defaultValue={initial.bio} placeholder="Aparece na página pública ao escolher o profissional" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="specialties">Especialidades</label>
          <input id="specialties" name="specialties" className="input" defaultValue={initial.specialties} placeholder="Corte, coloração, mechas" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Telefone</label>
          <input id="phone" name="phone" inputMode="tel" className="input" defaultValue={initial.phone} placeholder="(11) 99999-8888" />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" className="input" defaultValue={initial.email} />
        </div>
      </div>

      {canManage && units.length > 0 && (
        <div className="max-w-sm">
          <label className="label" htmlFor="unitId">Unidade</label>
          <select id="unitId" name="unitId" className="input" defaultValue={initial.unitId}>
            <option value="">Todas as unidades</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Onde esta pessoa atende. A cliente só vê o profissional da unidade que escolher.</p>
        </div>
      )}

      {canManage && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4 rounded border-zinc-300" />
            Ativo (aparece na página pública e recebe agendamentos)
          </label>

          <fieldset>
            <legend className="label">Serviços que executa e comissão combinada</legend>
            <p className="mb-2 text-xs text-zinc-500">
              Preencha só onde o acordo desta pessoa é diferente da <Link href="/app/comissoes/tabela" className="underline">tabela padrão</Link>; vazio usa o valor da tabela.
              A comissão é apurada sobre o valor do serviço (com adicionais) quando a visita é concluída.
            </p>
            {services.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum serviço cadastrado ainda.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {services.map((s) => (
                  <div key={`${s.id}:${s.agreement.percent ?? ""}:${s.agreement.fixedCents ?? ""}`} className={`rounded-lg border border-zinc-200 px-3 py-2 text-sm ${s.active ? "" : "opacity-60"}`}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={s.checked} className="h-4 w-4 rounded border-zinc-300" />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      {!s.active && <span className="text-xs text-zinc-400">inativo</span>}
                    </label>
                    <div className="mt-1.5 flex items-center gap-2 pl-6">
                      <select name={`commissionKind_${s.id}`} defaultValue={s.agreement.fixedCents != null ? "brl" : "pct"} aria-label={`Tipo de comissão em ${s.name}`} className="rounded-md border border-zinc-200 px-1.5 py-1 text-xs">
                        <option value="pct">%</option>
                        <option value="brl">R$</option>
                      </select>
                      <input
                        name={`commission_${s.id}`} inputMode="decimal" autoComplete="off"
                        defaultValue={s.agreement.fixedCents != null ? (s.agreement.fixedCents / 100).toFixed(2).replace(".", ",") : s.agreement.percent ?? ""}
                        placeholder={`tabela: ${s.standardLabel}`} aria-label={`Comissão em ${s.name}`}
                        className="min-w-0 flex-1 rounded-md border border-zinc-200 px-2 py-1 text-right text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
        </>
      )}

      <SubmitButton>Salvar perfil</SubmitButton>
    </form>
  );
}

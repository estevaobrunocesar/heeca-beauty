"use client";

import { useActionState } from "react";
import { saveCommissionTableAction } from "@/actions/commissions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

type Row = { id: string; name: string; active: boolean; price: string; percent: number | null; fixedCents: number | null };

export function TableForm({ services }: { services: Row[] }) {
  const [state, action] = useActionState<ActionResult, FormData>(saveCommissionTableAction, null);
  return (
    <form action={action} className="card space-y-4 p-4 sm:p-6">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}

      <ul className="divide-y divide-zinc-100">
        {services.map((s) => (
          // A chave inclui o valor salvo: depois de salvar, a linha é recriada e o tipo (%/R$) acompanha o campo.
          <li key={`${s.id}:${s.percent ?? ""}:${s.fixedCents ?? ""}`} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 ${s.active ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-sm font-medium">{s.name}{!s.active && <span className="ml-2 text-xs font-normal text-zinc-400">inativo</span>}</p>
              <p className="text-xs text-zinc-500">{s.price}</p>
            </div>
            <div className="flex items-center gap-2">
              <select name={`commissionKind_${s.id}`} defaultValue={s.fixedCents != null ? "brl" : "pct"} aria-label={`Tipo de comissão em ${s.name}`} className="rounded-md border border-zinc-200 px-1.5 py-1.5 text-sm">
                <option value="pct">%</option>
                <option value="brl">R$</option>
              </select>
              <input
                name={`commission_${s.id}`} inputMode="decimal" autoComplete="off"
                defaultValue={s.fixedCents != null ? (s.fixedCents / 100).toFixed(2).replace(".", ",") : s.percent ?? ""}
                placeholder="sem comissão" aria-label={`Comissão padrão em ${s.name}`}
                className="w-28 rounded-md border border-zinc-200 px-2 py-1.5 text-right text-sm"
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-zinc-500">
        Em %, a comissão é calculada sobre o valor do serviço (com adicionais). Em R$, é um valor fixo por atendimento. Vale para as visitas concluídas daqui para a frente; o que já foi apurado não muda.
      </p>
      <SubmitButton>Salvar tabela</SubmitButton>
    </form>
  );
}

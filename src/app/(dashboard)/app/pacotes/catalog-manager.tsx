"use client";

import { useActionState, useState, useTransition } from "react";
import { createPackageAction, togglePackageAction, updatePackageAction } from "@/actions/packages";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

export type CatalogRow = { id: string; name: string; description: string | null; scope: string; scopeLabel: string; sessionsCount: number; validityDays: number | null; priceCents: number; priceLabel: string; active: boolean; onlineVisible: boolean; sold: number };
type Opt = { id: string; name: string };

/** Catálogo de pacotes: lista + criar/editar inline. O escopo decide o que a sessão pode cobrir. */
export function CatalogManager({ packages, services, categories }: { packages: CatalogRow[]; services: Opt[]; categories: Opt[] }) {
  const [novo, setNovo] = useState(packages.length === 0);
  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div>
          <h2 className="font-medium">Catálogo <span className="font-normal text-zinc-400">({packages.length})</span></h2>
          <p className="text-xs text-zinc-500">O que você vende. Visível na página pública leva o cliente ao WhatsApp.</p>
        </div>
        {!novo && <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setNovo(true)}>+ Pacote</button>}
      </div>
      <div className="divide-y divide-zinc-100">
        {packages.map((p) => <CatalogLine key={p.id} pkg={p} services={services} categories={categories} />)}
        {novo && <PackageForm services={services} categories={categories} onDone={() => setNovo(false)} />}
      </div>
    </section>
  );
}

function CatalogLine({ pkg, services, categories }: { pkg: CatalogRow; services: Opt[]; categories: Opt[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (editing) return <PackageForm initial={pkg} services={services} categories={categories} onDone={() => setEditing(false)} />;
  return (
    <div className={`px-4 py-3 text-sm ${pkg.active ? "" : "opacity-50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{pkg.name} <span className="font-normal text-zinc-500">· {pkg.priceLabel}</span></div>
          <div className="text-xs text-zinc-500">{pkg.sessionsCount} sessões · {pkg.scopeLabel}{pkg.validityDays ? ` · ${pkg.validityDays} dias` : " · sem validade"}{pkg.onlineVisible ? " · na página" : ""} · {pkg.sold} vendido(s)</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(true)}>Editar</button>
          <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => togglePackageAction(pkg.id))}>{pkg.active ? "Desativar" : "Reativar"}</button>
        </div>
      </div>
    </div>
  );
}

function PackageForm({ initial, services, categories, onDone }: { initial?: CatalogRow; services: Opt[]; categories: Opt[]; onDone: () => void }) {
  const action = initial ? updatePackageAction.bind(null, initial.id) : createPackageAction;
  const [state, formAction] = useActionState<ActionResult, FormData>(async (prev, fd) => { const r = await action(prev, fd); if (r?.ok) onDone(); return r; }, null);
  return (
    <form action={formAction} className="space-y-3 px-4 py-3">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <input name="name" required maxLength={80} className="input" defaultValue={initial?.name ?? ""} placeholder="Nome (ex.: 5 massagens relaxantes)" />
      <select name="scope" className="input" defaultValue={initial?.scope ?? "any"}>
        <option value="any">Qualquer serviço</option>
        {categories.length > 0 && <optgroup label="Qualquer serviço da categoria">{categories.map((c) => <option key={c.id} value={`category:${c.id}`}>{c.name}</option>)}</optgroup>}
        {services.length > 0 && <optgroup label="Só este serviço">{services.map((s) => <option key={s.id} value={`service:${s.id}`}>{s.name}</option>)}</optgroup>}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label" htmlFor={`sc-${initial?.id ?? "novo"}`}>Sessões</label>
          <input id={`sc-${initial?.id ?? "novo"}`} name="sessionsCount" type="number" min={1} max={200} required className="input" defaultValue={initial?.sessionsCount ?? 5} />
        </div>
        <div>
          <label className="label" htmlFor={`vd-${initial?.id ?? "novo"}`}>Validade (dias)</label>
          <input id={`vd-${initial?.id ?? "novo"}`} name="validityDays" type="number" min={0} max={3650} className="input" defaultValue={initial?.validityDays ?? 90} placeholder="0 = sem" />
        </div>
        <div>
          <label className="label" htmlFor={`pr-${initial?.id ?? "novo"}`}>Preço (R$)</label>
          <input id={`pr-${initial?.id ?? "novo"}`} name="price" required inputMode="decimal" className="input" defaultValue={initial ? (initial.priceCents / 100).toFixed(2).replace(".", ",") : ""} placeholder="450,00" />
        </div>
      </div>
      <input name="description" maxLength={300} className="input" defaultValue={initial?.description ?? ""} placeholder="Descrição para a página pública (opcional)" />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="onlineVisible" defaultChecked={initial?.onlineVisible ?? true} className="h-4 w-4 rounded border-zinc-300" /> Mostrar na página pública</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="h-4 w-4 rounded border-zinc-300" /> Ativo</label>
      </div>
      <div className="flex gap-2">
        <SubmitButton>{initial ? "Salvar" : "Criar pacote"}</SubmitButton>
        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { createUnitAction, toggleUnitAction, updateUnitAction } from "@/actions/units";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

export type UnitRow = { id: string; name: string; address: string | null; phone: string; active: boolean; professionals: number; rooms: number; appointments: number };

export function UnitsManager({ units }: { units: UnitRow[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(createUnitAction, null);
  return (
    <section className="card">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="font-medium">Unidades <span className="font-normal text-zinc-400">({units.length})</span></h2>
        <p className="text-xs text-zinc-500">Com duas ou mais unidades ativas, a cliente escolhe a unidade ao agendar e vê só os profissionais dela.</p>
      </div>
      <div className="divide-y divide-zinc-100">
        {units.map((u) => <UnitLine key={u.id} unit={u} />)}
        {units.length === 0 && <p className="px-4 py-6 text-center text-sm text-zinc-500">Nenhuma unidade cadastrada. Se você tem só um endereço, não precisa cadastrar nada.</p>}
        <form action={formAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1.4fr_9rem_auto]">
          <input name="name" required maxLength={60} className="input" placeholder="Nome (ex.: Unidade Centro)" aria-label="Nome da unidade" />
          <input name="address" maxLength={200} className="input" placeholder="Endereço (opcional)" aria-label="Endereço" />
          <input name="phone" inputMode="tel" className="input" placeholder="Telefone" aria-label="Telefone" />
          <SubmitButton>Adicionar</SubmitButton>
          {state && !state.ok && <div className="sm:col-span-4"><Alert>{state.error}</Alert></div>}
        </form>
      </div>
    </section>
  );
}

function UnitLine({ unit }: { unit: UnitRow }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [state, formAction] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await updateUnitAction(unit.id, prev, fd);
    if (r?.ok) setEditing(false);
    return r;
  }, null);
  if (editing) {
    return (
      <form action={formAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1.4fr_9rem]">
        <input name="name" defaultValue={unit.name} required maxLength={60} className="input" autoFocus aria-label="Nome" />
        <input name="address" defaultValue={unit.address ?? ""} maxLength={200} className="input" placeholder="Endereço" aria-label="Endereço" />
        <input name="phone" defaultValue={unit.phone} inputMode="tel" className="input" placeholder="Telefone" aria-label="Telefone" />
        <div className="flex items-center gap-2 sm:col-span-3">
          <SubmitButton>Salvar</SubmitButton>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(false)}>Cancelar</button>
          {state && !state.ok && <span className="text-xs text-rose-600">{state.error}</span>}
        </div>
      </form>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${unit.active ? "" : "opacity-50"}`}>
      <div className="min-w-48 flex-1">
        <p className="font-medium">{unit.name}{!unit.active && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-normal text-zinc-600">desativada</span>}</p>
        <p className="text-xs text-zinc-500">
          {[unit.address, unit.phone].filter(Boolean).join(" · ") || "sem endereço"} · {unit.professionals} {unit.professionals === 1 ? "profissional" : "profissionais"} · {unit.rooms} sala{unit.rooms === 1 ? "" : "s"} · {unit.appointments} agendamento{unit.appointments === 1 ? "" : "s"}
        </p>
      </div>
      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(true)}>Editar</button>
      <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(async () => { await toggleUnitAction(unit.id); })}>{unit.active ? "Desativar" : "Reativar"}</button>
    </div>
  );
}

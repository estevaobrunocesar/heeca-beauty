"use client";

import { useActionState, useState, useTransition } from "react";
import { createRoomAction, moveRoomAction, toggleRoomAction, updateRoomAction } from "@/actions/rooms";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

export type RoomRow = { id: string; name: string; kind: string | null; capacity: number; description: string | null; active: boolean; services: number };

/** Salas na ordem em que o motor as escolhe ("Sala 01" enche antes da "Sala 02"): lista ordenável + criar + editar inline + desativar. */
export function RoomsManager({ rooms }: { rooms: RoomRow[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(createRoomAction, null);
  return (
    <section className="card">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="font-medium">Salas <span className="font-normal text-zinc-400">({rooms.length})</span></h2>
        <p className="text-xs text-zinc-500">Na ordem daqui o sistema escolhe a primeira livre. Sala desativada não recebe agendamentos novos.</p>
      </div>
      <div className="divide-y divide-zinc-100">
        {rooms.map((r, i) => <RoomLine key={r.id} room={r} isFirst={i === 0} isLast={i === rooms.length - 1} />)}
        {rooms.length === 0 && <p className="px-4 py-6 text-center text-sm text-zinc-500">Nenhuma sala ainda. Cadastre a primeira abaixo.</p>}
        <form action={formAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input name="name" required maxLength={60} className="input" placeholder="Nome (ex.: Sala 01)" />
          <input name="kind" maxLength={40} className="input" placeholder="Tipo (ex.: Massagem, Casal)" />
          <input name="capacity" type="number" min={1} max={20} defaultValue={1} className="input w-24" title="Capacidade (pessoas)" />
          <SubmitButton>Adicionar</SubmitButton>
          {state && !state.ok && <div className="sm:col-span-4"><Alert>{state.error}</Alert></div>}
        </form>
      </div>
    </section>
  );
}

function RoomLine({ room, isFirst, isLast }: { room: RoomRow; isFirst: boolean; isLast: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (prev, fd) => { const r = await updateRoomAction(room.id, prev, fd); if (r?.ok) setEditing(false); return r; },
    null,
  );
  const iconBtn = "rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30";
  if (editing) {
    return (
      <form action={formAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
        <input name="name" defaultValue={room.name} required maxLength={60} className="input" autoFocus />
        <input name="kind" defaultValue={room.kind ?? ""} maxLength={40} className="input" placeholder="Tipo" />
        <input name="capacity" type="number" min={1} max={20} defaultValue={room.capacity} className="input w-24" />
        <input name="description" defaultValue={room.description ?? ""} maxLength={300} className="input sm:col-span-3" placeholder="Descrição (opcional)" />
        <div className="flex items-center gap-2 sm:col-span-3">
          <SubmitButton>Salvar</SubmitButton>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(false)}>Cancelar</button>
          {state && !state.ok && <span className="text-xs text-rose-600">{state.error}</span>}
        </div>
      </form>
    );
  }
  return (
    <div className={`flex items-center gap-2 px-4 py-2 ${room.active ? "" : "opacity-50"}`}>
      <span className="flex-1 text-sm">
        <span className="font-medium">{room.name}</span>
        {room.kind && <span className="ml-2 text-xs text-zinc-500">{room.kind}</span>}
        {room.capacity > 1 && <span className="ml-2 text-xs text-zinc-500">· {room.capacity} pessoas</span>}
        <span className="ml-2 text-xs text-zinc-400">· {room.services} {room.services === 1 ? "serviço" : "serviços"}</span>
        {!room.active && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">desativada</span>}
      </span>
      <button className={iconBtn} disabled={pending || isFirst} title="Subir" onClick={() => start(() => moveRoomAction(room.id, "up"))}>↑</button>
      <button className={iconBtn} disabled={pending || isLast} title="Descer" onClick={() => start(() => moveRoomAction(room.id, "down"))}>↓</button>
      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(true)}>Editar</button>
      <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => toggleRoomAction(room.id))}>{room.active ? "Desativar" : "Reativar"}</button>
    </div>
  );
}

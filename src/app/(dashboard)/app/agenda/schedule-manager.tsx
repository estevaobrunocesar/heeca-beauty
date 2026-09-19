"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createBlockAction, deleteBlockAction, deleteExceptionAction, upsertExceptionAction } from "@/actions/schedule";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { fmtDateTime, fmtDate } from "@/lib/dates";

type Block = { id: string; kind: string; startsAt: string; endsAt: string; reason: string | null; professionalName: string | null };
type Exception = { id: string; date: string; kind: string; reason: string | null; hours: string | null; professionalName: string | null };
type Pro = { id: string; name: string };

type Props = { tz: string; professionals: Pro[]; defaultProfessionalId: string; blocks: Block[]; exceptions: Exception[]; rangeLabel: string };

export function ScheduleManager({ tz, professionals, defaultProfessionalId, blocks, exceptions, rangeLabel }: Props) {
  const [open, setOpen] = useState<"none" | "exception" | "block">("none");
  const [pending, start] = useTransition();

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Folgas, bloqueios e férias</h2>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setOpen(open === "exception" ? "none" : "exception")}>+ Folga / horário especial</button>
          <button className="btn-secondary" onClick={() => setOpen(open === "block" ? "none" : "block")}>+ Bloqueio / férias</button>
        </div>
      </div>

      {open === "exception" && <ExceptionForm professionals={professionals} defaultProfessionalId={defaultProfessionalId} onDone={() => setOpen("none")} />}
      {open === "block" && <BlockForm professionals={professionals} defaultProfessionalId={defaultProfessionalId} onDone={() => setOpen("none")} />}

      {blocks.length === 0 && exceptions.length === 0 ? (
        <p className="text-sm text-zinc-500">Nada registrado {rangeLabel}.</p>
      ) : (
        <ul className="card divide-y divide-zinc-100 text-sm">
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>
                {e.professionalName && <span className="mr-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{e.professionalName}</span>}
                <span className="font-medium">{fmtDate(new Date(e.date + "T12:00:00"), tz)}</span>{" "}
                {e.kind === "CLOSED" ? "· Folga" : `· Horário especial ${e.hours}`}
                {e.reason && <span className="text-zinc-500"> · {e.reason}</span>}
              </span>
              <button disabled={pending} className="text-xs text-rose-600 hover:underline" onClick={() => start(() => deleteExceptionAction(e.id))}>Remover</button>
            </li>
          ))}
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>
                {b.professionalName && <span className="mr-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{b.professionalName}</span>}
                <span className="font-medium">{b.kind === "VACATION" ? "Férias" : "Bloqueio"}</span>{" "}
                · {fmtDateTime(new Date(b.startsAt), tz)} → {fmtDateTime(new Date(b.endsAt), tz)}
                {b.reason && <span className="text-zinc-500"> · {b.reason}</span>}
              </span>
              <button disabled={pending} className="text-xs text-rose-600 hover:underline" onClick={() => start(() => deleteBlockAction(b.id))}>Remover</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProfessionalSelect({ professionals, defaultProfessionalId }: { professionals: Pro[]; defaultProfessionalId: string }) {
  if (professionals.length <= 1) return <input type="hidden" name="professionalId" value={professionals[0]?.id ?? defaultProfessionalId} />;
  return (
    <div>
      <label className="label">Profissional</label>
      <select name="professionalId" defaultValue={defaultProfessionalId} className="input">
        {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}

function ExceptionForm({ professionals, defaultProfessionalId, onDone }: { professionals: Pro[]; defaultProfessionalId: string; onDone: () => void }) {
  const [state, action] = useActionState(upsertExceptionAction, null);
  const [kind, setKind] = useState("CLOSED");
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action} className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_160px_180px_1fr_auto] sm:items-end">
      {state && !state.ok && <div className="sm:col-span-5"><Alert>{state.error}</Alert></div>}
      <ProfessionalSelect professionals={professionals} defaultProfessionalId={defaultProfessionalId} />
      <div>
        <label className="label">Data</label>
        <input type="date" name="date" required className="input" />
      </div>
      <div>
        <label className="label">Tipo</label>
        <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="CLOSED">Folga (dia fechado)</option>
          <option value="CUSTOM_HOURS">Horário especial</option>
        </select>
      </div>
      <div className="flex gap-2">
        {kind === "CUSTOM_HOURS" ? (
          <>
            <div className="flex-1"><label className="label">Das</label><input type="time" name="start" className="input" /></div>
            <div className="flex-1"><label className="label">Às</label><input type="time" name="end" className="input" /></div>
          </>
        ) : (
          <div className="flex-1"><label className="label">Motivo (opcional)</label><input name="reason" className="input" placeholder="Feriado" /></div>
        )}
      </div>
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}

function BlockForm({ professionals, defaultProfessionalId, onDone }: { professionals: Pro[]; defaultProfessionalId: string; onDone: () => void }) {
  const [state, action] = useActionState(createBlockAction, null);
  const [kind, setKind] = useState("BLOCK");
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action} className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_150px_1fr_1fr_1fr_auto] sm:items-end">
      {state && !state.ok && <div className="sm:col-span-6"><Alert>{state.error}</Alert></div>}
      <ProfessionalSelect professionals={professionals} defaultProfessionalId={defaultProfessionalId} />
      <div>
        <label className="label">Tipo</label>
        <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="BLOCK">Bloqueio</option>
          <option value="VACATION">Férias</option>
        </select>
      </div>
      <div className="flex gap-2">
        <div className="flex-1"><label className="label">Início</label><input type="date" name="startDate" required className="input" /></div>
        {kind === "BLOCK" && <div className="w-28"><label className="label">Hora</label><input type="time" name="startTime" className="input" /></div>}
      </div>
      <div className="flex gap-2">
        <div className="flex-1"><label className="label">Fim</label><input type="date" name="endDate" required className="input" /></div>
        {kind === "BLOCK" && <div className="w-28"><label className="label">Hora</label><input type="time" name="endTime" className="input" /></div>}
      </div>
      <div><label className="label">Motivo</label><input name="reason" className="input" placeholder="Dentista" /></div>
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}

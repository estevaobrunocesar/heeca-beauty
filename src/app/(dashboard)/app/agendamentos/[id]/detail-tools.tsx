"use client";

import { useState, useTransition } from "react";
import { rescheduleAction, resendConfirmationAction, updateInternalNotesAction } from "@/actions/appointments";
import { SlotPicker } from "@/components/slot-picker";
import { Alert } from "@/components/ui/alert";

export function DetailTools({ id, slug, todayKey, maxAdvanceDays, internalNotes, canReschedule, canResend }: {
  id: string; slug: string; todayKey: string; maxAdvanceDays: number;
  internalNotes: string; canReschedule: boolean; canResend: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [slot, setSlot] = useState<{ dateKey: string; minutes: number } | null>(null);
  const [notes, setNotes] = useState(internalNotes);

  const report = (r: { ok: boolean; message?: string; error?: string } | null, fallback: string) =>
    setMsg(r?.ok ? { ok: true, text: r.message || fallback } : { ok: false, text: r?.error ?? "Erro" });

  return (
    <section className="card space-y-4 p-5">
      {msg && <Alert kind={msg.ok ? "success" : "error"}>{msg.text}</Alert>}

      <div className="flex flex-wrap gap-2">
        {canReschedule && (
          <button className="btn-secondary" onClick={() => setShowReschedule((v) => !v)}>{showReschedule ? "Fechar reagendamento" : "Reagendar"}</button>
        )}
        {canResend && (
          <button className="btn-secondary" disabled={pending} onClick={() => start(async () => report(await resendConfirmationAction(id), "Mensagem reenviada"))}>
            Reenviar WhatsApp
          </button>
        )}
      </div>

      {showReschedule && (
        <div className="space-y-3 border-t border-zinc-100 pt-4">
          <p className="text-sm text-zinc-600">Escolha o novo horário. A cliente receberá a atualização por WhatsApp.</p>
          <SlotPicker slug={slug} excludeAppointmentId={id} todayKey={todayKey} maxAdvanceDays={maxAdvanceDays} value={slot} onChange={setSlot} />
          <button
            className="btn-primary"
            disabled={!slot || pending}
            onClick={() => start(async () => {
              const r = await rescheduleAction(id, slot!.dateKey, slot!.minutes);
              report(r, "Reagendado!");
              if (r?.ok) { setShowReschedule(false); setSlot(null); }
            })}
          >
            Confirmar novo horário
          </button>
        </div>
      )}

      <div className="border-t border-zinc-100 pt-4">
        <label className="label" htmlFor="internalNotes">Anotações internas (só você vê)</label>
        <textarea id="internalNotes" rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: usou fibra tamanho 5 no polegar, cor Risqué Nude Chic" />
        <button className="btn-secondary mt-2" disabled={pending || notes === internalNotes} onClick={() => start(async () => report(await updateInternalNotesAction(id, notes), "Salvo"))}>
          Salvar anotações
        </button>
      </div>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { setStatusAction } from "@/actions/appointments";
import { canTransition } from "@/lib/appointments/status";

export function QuickActions({ id, status, full }: { id: string; status: AppointmentStatus; full?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (to: AppointmentStatus, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const r = await setStatusAction(id, to, to === "CANCELLED_BY_PROFESSIONAL" ? "Cancelado pela profissional" : undefined);
      if (r && !r.ok) setError(r.error);
    });
  };

  const can = (to: AppointmentStatus) => canTransition("PROFESSIONAL", status, to);
  const btn = "btn px-2.5 py-1 text-xs";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {error && <span className="text-xs text-rose-600">{error}</span>}
      {can("CONFIRMED") && (
        <button disabled={pending} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} onClick={() => run("CONFIRMED")}>
          {status === "RESCHEDULE_REQUESTED" ? "Manter horário" : "Confirmar"}
        </button>
      )}
      {can("COMPLETED") && (
        <button disabled={pending} className={`${btn} border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100`} onClick={() => run("COMPLETED")}>Concluído</button>
      )}
      {can("NO_SHOW") && (
        <button disabled={pending} className={`${btn} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`} onClick={() => run("NO_SHOW", "Marcar como não compareceu?")}>Faltou</button>
      )}
      {can("CANCELLED_BY_PROFESSIONAL") && (
        <button disabled={pending} className={`${btn} text-zinc-600 hover:bg-zinc-100`} onClick={() => run("CANCELLED_BY_PROFESSIONAL", "Cancelar este agendamento? A cliente será avisada por WhatsApp.")}>Cancelar</button>
      )}
      {!full && <Link href={`/app/agendamentos/${id}`} className={`${btn} text-zinc-600 hover:bg-zinc-100`}>Detalhes</Link>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { clientCancelAction, clientConfirmAction, clientRequestRescheduleAction } from "@/actions/public";

export function ConfirmButtons({ token, canConfirm, canReschedule, canCancel, cancelReason }: { token: string; canConfirm: boolean; canReschedule: boolean; canCancel: boolean; cancelReason: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: (t: string) => Promise<{ ok: boolean; error?: string } | null>) =>
    start(async () => {
      setError(null);
      const r = await fn(token);
      if (r && !r.ok) setError(r.error ?? "Erro");
    });

  return (
    <div className="mt-5 space-y-2">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {canConfirm && (
        <button disabled={pending} className="btn-accent w-full py-3 text-base" onClick={() => run(clientConfirmAction)}>
          ✅ Confirmar meu horário
        </button>
      )}
      {canReschedule && (
        <button disabled={pending} className="btn-secondary w-full" onClick={() => run(clientRequestRescheduleAction)}>
          🔁 Preciso remarcar
        </button>
      )}
      {canCancel ? (
        <button
          disabled={pending}
          className="btn-ghost w-full text-zinc-500"
          onClick={() => { if (confirm("Tem certeza que deseja cancelar?")) run(clientCancelAction); }}
        >
          Cancelar agendamento
        </button>
      ) : (
        cancelReason && <p className="text-center text-xs text-zinc-500">{cancelReason}</p>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { completeAppointmentAction } from "@/actions/appointments";
import { MAX_CHARGES, parseExtras, totalExtras, type ExtraInput } from "@/lib/appointments/charges";
import { formatCents } from "@/lib/money";

/**
 * Ao concluir o atendimento: houve valores adicionais (produtos usados, material extra)? Se sim, descrição e valor de
 * cada um. Os adicionais entram no faturamento; a comissão continua só sobre os serviços.
 */
export function CompleteDialog({ id, serviceTotalCents, onClose }: { id: string; serviceTotalCents?: number; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [temExtras, setTemExtras] = useState(false);
  const [lines, setLines] = useState<ExtraInput[]>([{ description: "", amount: "" }]);
  const [error, setError] = useState<string | null>(null);

  const parsed = temExtras ? parseExtras(lines) : { ok: true as const, extras: [] };
  const extras = parsed.ok ? parsed.extras : [];
  const total = totalExtras(extras);

  const setLine = (i: number, patch: Partial<ExtraInput>) => setLines((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const confirmar = () => {
    setError(null);
    start(async () => {
      const r = await completeAppointmentAction(id, temExtras ? lines : []);
      if (r && !r.ok) { setError(r.error); return; }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal aria-label="Concluir atendimento" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Concluir atendimento</h2>
        <p className="mt-3 text-sm font-medium text-zinc-800">Houve valores adicionais?</p>
        <p className="text-xs text-zinc-500">Produtos usados ou material extra cobrados além dos serviços.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={!temExtras} onClick={() => setTemExtras(false)} className={`btn py-2 text-sm ${!temExtras ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700"}`}>Não</button>
          <button type="button" aria-pressed={temExtras} onClick={() => setTemExtras(true)} className={`btn py-2 text-sm ${temExtras ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700"}`}>Sim</button>
        </div>

        {temExtras && (
          <div className="mt-4 space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="rounded-lg border border-zinc-200 p-3">
                <label className="label" htmlFor={`extra-desc-${i}`}>Observações</label>
                <input id={`extra-desc-${i}`} className="input" maxLength={120} placeholder="Ex.: tinta extra, ampola de hidratação" value={line.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="label" htmlFor={`extra-val-${i}`}>Valor adicional (R$)</label>
                    <input id={`extra-val-${i}`} className="input" inputMode="decimal" placeholder="0,00" value={line.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
                  </div>
                  {lines.length > 1 && <button type="button" className="btn-ghost px-2 py-2 text-rose-600" aria-label="Remover valor adicional" onClick={() => setLines((l) => l.filter((_, k) => k !== i))}>×</button>}
                </div>
              </div>
            ))}
            {lines.length < MAX_CHARGES && <button type="button" className="btn-secondary w-full" onClick={() => setLines((l) => [...l, { description: "", amount: "" }])}>+ Adicionar outro valor</button>}
            {!parsed.ok && lines.some((l) => l.description.trim() || l.amount.trim()) && <p className="text-xs text-amber-700">{parsed.error}</p>}
            {total > 0 && (
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                Adicionais: <strong>{formatCents(total)}</strong>
                {serviceTotalCents != null && <> · Total do atendimento: <strong>{formatCents(serviceTotalCents + total)}</strong></>}
              </p>
            )}
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={pending}>Voltar</button>
          <button type="button" className="btn-primary flex-1" onClick={confirmar} disabled={pending || (temExtras && !parsed.ok)}>{pending ? "Concluindo..." : "Concluir atendimento"}</button>
        </div>
      </div>
    </div>
  );
}

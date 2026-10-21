"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeProfessionalAction } from "@/actions/appointments";

type Option = { id: string; name: string };

/**
 * Troca quem faz um serviço do agendamento (a cliente chegou e preferiu outro profissional). Só aparece antes de concluir:
 * a comissão é apurada ao concluir, no profissional que estiver no serviço.
 */
export function ChangeProfessional({ appointmentId, itemId, options }: { appointmentId: string; itemId: string; options: Option[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [professionalId, setProfessionalId] = useState(options[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  if (options.length === 0) return null;

  const trocar = () => {
    setError(null);
    start(async () => {
      const r = await changeProfessionalAction({ appointmentId, itemId, professionalId });
      if (r && !r.ok) { setError(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) return <button type="button" className="text-xs text-brand-700 underline" onClick={() => setOpen(true)}>Trocar profissional</button>;
  return (
    <span className="flex basis-full flex-wrap items-center gap-2 pl-[6.5rem] text-xs">
      <select aria-label="Novo profissional" className="input h-8 w-auto py-0 text-xs" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={pending}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <button type="button" className="btn-primary px-2.5 py-1 text-xs" onClick={trocar} disabled={pending}>{pending ? "Trocando..." : "Trocar"}</button>
      <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => { setOpen(false); setError(null); }} disabled={pending}>Cancelar</button>
      {error && <span role="alert" className="basis-full text-rose-600">{error}</span>}
    </span>
  );
}

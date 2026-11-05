"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replaceServiceAction } from "@/actions/appointments";
import { formatCents } from "@/lib/money";

type Pro = { id: string; name: string };
type Service = { id: string; name: string; durationMinutes: number; priceCents: number; professionalIds: string[] };
type AddOn = { id: string; name: string; durationMinutes: number; priceCents: number };

/**
 * Troca o procedimento de um serviço do agendamento (a cliente marcou um e decidiu fazer outro). O horário de início fica;
 * duração, valor e adicionais passam a ser os do serviço novo. Só aparece antes de concluir.
 */
export function ReplaceService({ appointmentId, itemId, currentServiceId, currentProfessionalId, services, addOns, professionals }: {
  appointmentId: string; itemId: string; currentServiceId: string; currentProfessionalId: string;
  services: Service[]; addOns: AddOn[]; professionals: Pro[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState(currentProfessionalId);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const opcoes = services.filter((s) => s.id !== currentServiceId);
  if (opcoes.length === 0) return null;

  const servico = opcoes.find((s) => s.id === serviceId);
  // Quem faz o serviço novo: o profissional atual, se ele faz; senão a recepção escolhe entre quem faz.
  const quemFaz = servico ? professionals.filter((p) => servico.professionalIds.includes(p.id)) : [];
  const escolherServico = (id: string) => {
    setServiceId(id);
    const doNovo = professionals.filter((p) => opcoes.find((s) => s.id === id)?.professionalIds.includes(p.id));
    setProfessionalId(doNovo.some((p) => p.id === currentProfessionalId) ? currentProfessionalId : doNovo[0]?.id ?? "");
  };
  const extras = addOns.filter((a) => addOnIds.includes(a.id));
  const valor = (servico?.priceCents ?? 0) + extras.reduce((n, a) => n + a.priceCents, 0);
  const fechar = () => { setOpen(false); setError(null); setServiceId(""); setAddOnIds([]); };

  const trocar = () => {
    if (!servico || !professionalId) return;
    setError(null);
    start(async () => {
      const r = await replaceServiceAction({ appointmentId, itemId, serviceId, professionalId, addOnIds });
      if (r && !r.ok) { setError(r.error); return; }
      fechar();
      router.refresh();
    });
  };

  if (!open) return <button type="button" className="text-xs text-brand-700 underline" onClick={() => setOpen(true)}>Trocar serviço</button>;
  return (
    <span className="flex basis-full flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs sm:ml-[6.5rem] sm:basis-auto sm:min-w-80">
      <label className="flex flex-col gap-1">
        <span className="font-medium text-zinc-700">Novo serviço</span>
        <select className="input h-9 py-0 text-sm" value={serviceId} onChange={(e) => escolherServico(e.target.value)} disabled={pending}>
          <option value="">Escolha o serviço</option>
          {opcoes.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min · {formatCents(s.priceCents)}</option>)}
        </select>
      </label>
      {servico && quemFaz.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="font-medium text-zinc-700">Quem faz</span>
          <select className="input h-9 py-0 text-sm" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={pending}>
            {quemFaz.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      {servico && addOns.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {addOns.map((a) => {
            const on = addOnIds.includes(a.id);
            return (
              <button key={a.id} type="button" onClick={() => setAddOnIds((l) => (on ? l.filter((x) => x !== a.id) : [...l, a.id]))} disabled={pending}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition ${on ? "border-brand-500 bg-brand-50 text-brand-800" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"}`}>
                {on ? "✓ " : "+ "}{a.name} <span className="text-zinc-500">{formatCents(a.priceCents)}</span>
              </button>
            );
          })}
        </div>
      )}
      {servico && <p className="text-zinc-500">O horário de início continua o mesmo. Novo valor do serviço: <strong className="text-zinc-800">{formatCents(valor)}</strong>.</p>}
      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary px-2.5 py-1 text-xs" onClick={trocar} disabled={pending || !servico || !professionalId}>{pending ? "Trocando..." : "Trocar serviço"}</button>
        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={fechar} disabled={pending}>Cancelar</button>
      </div>
      {error && <span role="alert" className="text-rose-600">{error}</span>}
    </span>
  );
}

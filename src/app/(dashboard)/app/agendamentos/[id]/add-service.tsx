"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addServiceAction } from "@/actions/appointments";
import { Avatar } from "@/components/dashboard/avatar";
import { Alert } from "@/components/ui/alert";
import { formatCents } from "@/lib/money";
import { hhmmToMinutes, minutesToHHMM } from "@/lib/dates";

type Pro = { id: string; name: string; photoUrl: string | null };
type Service = { id: string; name: string; durationMinutes: number; priceCents: number; professionalIds: string[] };
type AddOn = { id: string; name: string; durationMinutes: number; priceCents: number };

/**
 * Acrescenta um serviço a um agendamento ainda ativo: a cliente do cabelo decide fazer a unha na hora.
 * O horário vem preenchido (agora ou depois do último serviço) e pode ser ajustado; a agenda do profissional decide se cabe.
 */
export function AddServiceCard({ appointmentId, professionals, services, addOns, startNow, startAfter }: {
  appointmentId: string; professionals: Pro[]; services: Service[]; addOns: AddOn[];
  /** Início sugerido para "ao mesmo tempo" e para "depois do último serviço", em minutos do dia. */
  startNow: number; startAfter: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [professionalId, setProfessionalId] = useState(professionals[0]?.id ?? "");
  const disponiveis = useMemo(() => services.filter((s) => s.professionalIds.includes(professionalId)), [services, professionalId]);
  const [serviceId, setServiceId] = useState(() => services.find((s) => s.professionalIds.includes(professionals[0]?.id ?? ""))?.id ?? "");
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [quando, setQuando] = useState<"agora" | "depois">("agora");
  const [hora, setHora] = useState(minutesToHHMM(startNow));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const servico = disponiveis.find((s) => s.id === serviceId);
  const extras = addOns.filter((a) => addOnIds.includes(a.id));
  const duracao = (servico?.durationMinutes ?? 0) + extras.reduce((n, a) => n + a.durationMinutes, 0);
  const valor = (servico?.priceCents ?? 0) + extras.reduce((n, a) => n + a.priceCents, 0);
  const inicio = hhmmToMinutes(hora);

  const escolherProfissional = (id: string) => {
    setProfessionalId(id);
    const doNovo = services.filter((s) => s.professionalIds.includes(id));
    if (!doNovo.some((s) => s.id === serviceId)) setServiceId(doNovo[0]?.id ?? "");
  };
  const escolherQuando = (q: "agora" | "depois") => { setQuando(q); setHora(minutesToHHMM(q === "agora" ? startNow : startAfter)); };

  const adicionar = () => {
    if (!servico || inicio == null) return;
    setMsg(null);
    start(async () => {
      const r = await addServiceAction({ appointmentId, serviceId, professionalId, addOnIds, startMinutes: inicio });
      if (r && !r.ok) { setMsg({ ok: false, text: r.error }); return; }
      setMsg({ ok: true, text: (r && r.ok && r.message) || "Serviço acrescentado." });
      setAddOnIds([]);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <section className="card flex items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-medium">Acrescentar serviço</h2>
          <p className="text-sm text-zinc-500">A cliente decidiu fazer mais alguma coisa? Adicione ao mesmo atendimento.</p>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={() => setOpen(true)}>+ Acrescentar</button>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Acrescentar serviço</h2>
        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setOpen(false)}>Fechar</button>
      </div>
      {msg && <Alert kind={msg.ok ? "success" : "error"}>{msg.text}</Alert>}

      {professionals.length > 1 && (
        <div>
          <span className="label">Quem faz</span>
          <div className="flex flex-wrap gap-2">
            {professionals.map((p) => (
              <button key={p.id} type="button" onClick={() => escolherProfissional(p.id)} aria-pressed={professionalId === p.id}
                className={`btn gap-2 py-1 pl-1 pr-2.5 text-xs ${professionalId === p.id ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}>
                <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="add-service">Serviço</label>
        {disponiveis.length === 0 ? (
          <p className="text-sm text-zinc-500">Este profissional não tem serviços vinculados.</p>
        ) : (
          <select id="add-service" className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {disponiveis.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min · {formatCents(s.priceCents)}</option>)}
          </select>
        )}
        {addOns.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {addOns.map((a) => {
              const on = addOnIds.includes(a.id);
              return (
                <button key={a.id} type="button" onClick={() => setAddOnIds((l) => (on ? l.filter((x) => x !== a.id) : [...l, a.id]))}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition ${on ? "border-brand-500 bg-brand-50 text-brand-800" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"}`}>
                  {on ? "✓ " : "+ "}{a.name} <span className="text-zinc-500">{formatCents(a.priceCents)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <span className="label">Quando começa</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${quando === "agora" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
            <input type="radio" name="quando" checked={quando === "agora"} onChange={() => escolherQuando("agora")} className="mt-1" />
            <span><span className="font-medium">Agora, ao mesmo tempo</span><span className="block text-xs text-zinc-500">a partir de {minutesToHHMM(startNow)}</span></span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${quando === "depois" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
            <input type="radio" name="quando" checked={quando === "depois"} onChange={() => escolherQuando("depois")} className="mt-1" />
            <span><span className="font-medium">Depois do último serviço</span><span className="block text-xs text-zinc-500">a partir de {minutesToHHMM(startAfter)}</span></span>
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="text-sm text-zinc-600" htmlFor="add-hora">Horário</label>
          <input id="add-hora" type="time" step={300} className="input w-32" value={hora} onChange={(e) => setHora(e.target.value)} />
          {servico && inicio != null && <span className="text-xs text-zinc-500">termina às {minutesToHHMM(inicio + duracao)} · {formatCents(valor)}</span>}
        </div>
      </div>

      <button type="button" className="btn-primary w-full" disabled={pending || !servico || inicio == null} onClick={adicionar}>
        {pending ? "Acrescentando..." : "Acrescentar ao atendimento"}
      </button>
    </section>
  );
}

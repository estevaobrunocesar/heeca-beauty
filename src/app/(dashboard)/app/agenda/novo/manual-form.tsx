"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createManualAppointmentAction } from "@/actions/appointments";
import { SlotPicker } from "@/components/slot-picker";
import { Avatar } from "@/components/dashboard/avatar";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { formatCents } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { computeBookingTotals } from "@/lib/services/addons";

type Service = { id: string; name: string; durationMinutes: number; priceCents: number; professionalIds: string[] };
type AddOn = { id: string; name: string; durationMinutes: number; priceCents: number };
type ClientOpt = { name: string; phone: string };
type Pro = { id: string; name: string; photoUrl: string | null };

type Props = {
  slug: string; todayKey: string; maxAdvanceDays: number;
  professionals: Pro[]; defaultProfessionalId: string;
  services: Service[]; addOns: AddOn[]; clients: ClientOpt[]; preselected: ClientOpt | null;
};

export function ManualAppointmentForm({ slug, todayKey, maxAdvanceDays, professionals, defaultProfessionalId, services, addOns, clients, preselected }: Props) {
  const router = useRouter();
  const [state, action] = useActionState(createManualAppointmentAction, null);
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId);
  const available = services.filter((s) => s.professionalIds.includes(professionalId));
  const [serviceId, setServiceId] = useState(available[0]?.id ?? "");
  const [slot, setSlot] = useState<{ dateKey: string; minutes: number } | null>(null);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const service = services.find((s) => s.id === serviceId);
  const chosenAddOns = addOns.filter((a) => addOnIds.includes(a.id));
  const totals = service ? computeBookingTotals(service, chosenAddOns) : null;
  const toggleAddOn = (id: string) => { setAddOnIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])); setSlot(null); };
  const [name, setName] = useState(preselected?.name ?? "");
  const [phone, setPhone] = useState(preselected ? formatPhone(preselected.phone) : "");

  useEffect(() => {
    if (state?.ok) router.push(`/app/agendamentos/${state.message}`);
  }, [state, router]);

  const pickProfessional = (id: string) => {
    setProfessionalId(id);
    setSlot(null);
    const next = services.filter((s) => s.professionalIds.includes(id));
    if (!next.some((s) => s.id === serviceId)) setServiceId(next[0]?.id ?? "");
  };

  if (services.length === 0) return <Alert>Cadastre ao menos um procedimento ativo antes de agendar.</Alert>;

  return (
    <form action={action} className="space-y-6">
      {state && !state.ok && <Alert>{state.error}</Alert>}

      <section className="card space-y-4 p-5">
        <h2 className="font-medium">1. Cliente</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="clientName">Nome</label>
            <input id="clientName" name="clientName" list="clients" required className="input" value={name}
              onChange={(e) => {
                setName(e.target.value);
                const match = clients.find((c) => c.name === e.target.value);
                if (match) setPhone(formatPhone(match.phone));
              }} />
            <datalist id="clients">
              {clients.map((c) => <option key={c.phone} value={c.name} />)}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="clientPhone">WhatsApp</label>
            <input id="clientPhone" name="clientPhone" required inputMode="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-8888" />
          </div>
        </div>
      </section>

      {professionals.length > 1 && (
        <section className="card space-y-3 p-5">
          <h2 className="font-medium">2. Profissional</h2>
          <div className="flex flex-wrap gap-2">
            {professionals.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickProfessional(p.id)}
                className={`btn gap-2 py-1.5 pl-1.5 pr-3 text-sm ${professionalId === p.id ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}
              >
                <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}
      <input type="hidden" name="professionalId" value={professionalId} />

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">{professionals.length > 1 ? "3" : "2"}. Procedimento</h2>
        {available.length === 0 ? (
          <p className="text-sm text-zinc-500">Esta profissional não tem procedimentos vinculados.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((s) => (
              <label key={s.id} className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm ${serviceId === s.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
                <span>
                  <input type="radio" name="serviceId" value={s.id} checked={serviceId === s.id} onChange={() => { setServiceId(s.id); setSlot(null); }} className="mr-2" />
                  {s.name}
                </span>
                <span className="text-xs text-zinc-500">{s.durationMinutes} min · {formatCents(s.priceCents)}</span>
              </label>
            ))}
          </div>
        )}
        {addOns.length > 0 && (
          <div className="border-t border-zinc-100 pt-3">
            <p className="mb-2 text-sm text-zinc-600">Adicionais</p>
            <div className="flex flex-wrap gap-2">
              {addOns.map((a) => {
                const on = addOnIds.includes(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggleAddOn(a.id)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-brand-500 bg-brand-50 text-brand-800" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"}`}>
                    {on ? "✓ " : "+ "}{a.name} <span className="text-xs text-zinc-500">{formatCents(a.priceCents)}{a.durationMinutes ? ` · ${a.durationMinutes} min` : ""}</span>
                  </button>
                );
              })}
            </div>
            {totals && chosenAddOns.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">Total: {totals.durationMinutes} min · {formatCents(totals.priceCents)}</p>
            )}
          </div>
        )}
        <input type="hidden" name="addOnIds" value={addOnIds.join(",")} />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">{professionals.length > 1 ? "4" : "3"}. Data e horário</h2>
        {serviceId && (
          <SlotPicker slug={slug} serviceId={serviceId} addOnIds={addOnIds} professionalId={professionalId} todayKey={todayKey} maxAdvanceDays={maxAdvanceDays} value={slot} onChange={setSlot} />
        )}
        <input type="hidden" name="dateKey" value={slot?.dateKey ?? ""} />
        <input type="hidden" name="minutes" value={slot?.minutes ?? ""} />
        <div>
          <label className="label" htmlFor="notes">Observações (opcional)</label>
          <input id="notes" name="notes" className="input" placeholder="Ex.: quer trocar para formato bailarina" />
        </div>
      </section>

      <SubmitButton disabled={!slot} pendingText="Agendando...">Confirmar agendamento</SubmitButton>
    </form>
  );
}

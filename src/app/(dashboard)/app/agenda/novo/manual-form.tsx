"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createManualAppointmentAction } from "@/actions/appointments";
import { SlotPicker, type SlotPickerItem } from "@/components/slot-picker";
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

/** Um serviço da visita no formulário do painel: sempre com profissional definido (a recepção decide). */
type Item = { key: number; serviceId: string; professionalId: string; addOnIds: string[] };

type Props = {
  slug: string; todayKey: string; maxAdvanceDays: number;
  professionals: Pro[]; defaultProfessionalId: string;
  services: Service[]; addOns: AddOn[]; clients: ClientOpt[]; preselected: ClientOpt | null;
};

const MAX_ITEMS = 6;

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function ManualAppointmentForm({ slug, todayKey, maxAdvanceDays, professionals, defaultProfessionalId, services, addOns, clients, preselected }: Props) {
  const router = useRouter();
  const [state, action] = useActionState(createManualAppointmentAction, null);
  const servicesFor = (professionalId: string) => services.filter((s) => s.professionalIds.includes(professionalId));
  const firstService = (professionalId: string) => servicesFor(professionalId)[0]?.id ?? "";
  const [items, setItems] = useState<Item[]>([{ key: 1, serviceId: firstService(defaultProfessionalId), professionalId: defaultProfessionalId, addOnIds: [] }]);
  const [slot, setSlot] = useState<{ dateKey: string; minutes: number } | null>(null);
  const [name, setName] = useState(preselected?.name ?? "");
  const [phone, setPhone] = useState(preselected ? formatPhone(preselected.phone) : "");

  useEffect(() => {
    if (state?.ok) router.push(`/app/agendamentos/${state.message}`);
  }, [state, router]);

  const update = (key: number, patch: Partial<Item>) => {
    setSlot(null);
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  const setProfessional = (key: number, professionalId: string) => {
    const it = items.find((x) => x.key === key)!;
    // Serviço que o novo profissional não faz é trocado pelo primeiro que ele faz.
    const keep = servicesFor(professionalId).some((s) => s.id === it.serviceId);
    update(key, { professionalId, serviceId: keep ? it.serviceId : firstService(professionalId) });
  };
  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    const last = items[items.length - 1];
    setSlot(null);
    setItems((list) => [...list, { key: (last?.key ?? 0) + 1, serviceId: firstService(last?.professionalId ?? defaultProfessionalId), professionalId: last?.professionalId ?? defaultProfessionalId, addOnIds: [] }]);
  };
  const removeItem = (key: number) => { setSlot(null); setItems((list) => list.filter((it) => it.key !== key)); };
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    setSlot(null);
    setItems((list) => { const next = [...list]; [next[index], next[j]] = [next[j], next[index]]; return next; });
  };

  const resolved = items.map((it) => {
    const service = services.find((s) => s.id === it.serviceId);
    const chosen = addOns.filter((a) => it.addOnIds.includes(a.id));
    return { ...it, service, totals: service ? computeBookingTotals(service, chosen) : null };
  });
  const complete = resolved.every((r) => r.service);
  const totals = resolved.reduce((acc, r) => ({ durationMinutes: acc.durationMinutes + (r.totals?.durationMinutes ?? 0), priceCents: acc.priceCents + (r.totals?.priceCents ?? 0) }), { durationMinutes: 0, priceCents: 0 });
  const pickerItems: SlotPickerItem[] = items.map((it) => ({ serviceId: it.serviceId, professionalId: it.professionalId, addOnIds: it.addOnIds }));
  const payload = JSON.stringify(items.map((it) => ({ serviceId: it.serviceId, professionalId: it.professionalId, addOnIds: it.addOnIds })));

  if (services.length === 0) return <Alert>Cadastre ao menos um serviço ativo antes de agendar.</Alert>;

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

      <section className="card space-y-3 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">2. Serviços</h2>
          <span className="text-xs text-zinc-500">{items.length > 1 ? `${items.length} serviços · ` : ""}{fmtDuration(totals.durationMinutes)} · {formatCents(totals.priceCents)}</span>
        </div>
        {items.length > 1 && <p className="text-xs text-zinc-500">Nesta ordem, um depois do outro. Cada serviço ocupa a agenda do próprio profissional.</p>}

        <div className="space-y-3">
          {resolved.map((it, index) => {
            const available = servicesFor(it.professionalId);
            return (
              <div key={it.key} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex flex-wrap items-start gap-3">
                  {items.length > 1 && <span className="mt-2 w-5 text-sm text-zinc-400">{index + 1}.</span>}
                  <div className="min-w-0 flex-1 space-y-3">
                    {professionals.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {professionals.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProfessional(it.key, p.id)}
                            className={`btn gap-2 py-1 pl-1 pr-2.5 text-xs ${it.professionalId === p.id ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                          >
                            <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {available.length === 0 ? (
                      <p className="text-sm text-zinc-500">Este profissional não tem serviços vinculados.</p>
                    ) : (
                      <select className="input" value={it.serviceId} onChange={(e) => update(it.key, { serviceId: e.target.value })} aria-label="Serviço">
                        {available.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min · {formatCents(s.priceCents)}</option>
                        ))}
                      </select>
                    )}
                    {addOns.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {addOns.map((a) => {
                          const on = it.addOnIds.includes(a.id);
                          return (
                            <button key={a.id} type="button" onClick={() => update(it.key, { addOnIds: on ? it.addOnIds.filter((x) => x !== a.id) : [...it.addOnIds, a.id] })}
                              className={`rounded-full border px-2.5 py-0.5 text-xs transition ${on ? "border-brand-500 bg-brand-50 text-brand-800" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"}`}>
                              {on ? "✓ " : "+ "}{a.name} <span className="text-zinc-500">{formatCents(a.priceCents)}{a.durationMinutes ? ` · ${a.durationMinutes} min` : ""}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {items.length > 1 && (
                      <>
                        <button type="button" className="btn-ghost px-2 py-1" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Subir">↑</button>
                        <button type="button" className="btn-ghost px-2 py-1" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label="Descer">↓</button>
                        <button type="button" className="btn-ghost px-2 py-1 text-rose-600" onClick={() => removeItem(it.key)} aria-label="Remover">×</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {items.length < MAX_ITEMS && (
          <button type="button" className="btn-secondary" onClick={addItem}>+ Adicionar serviço</button>
        )}
        <input type="hidden" name="items" value={payload} />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">3. Data e horário</h2>
        {complete && (
          <SlotPicker slug={slug} items={pickerItems} todayKey={todayKey} maxAdvanceDays={maxAdvanceDays} value={slot} onChange={setSlot} />
        )}
        <input type="hidden" name="dateKey" value={slot?.dateKey ?? ""} />
        <input type="hidden" name="minutes" value={slot?.minutes ?? ""} />
        <div>
          <label className="label" htmlFor="notes">Observações (opcional)</label>
          <input id="notes" name="notes" className="input" placeholder="Ex.: cliente pediu a mesma cor da última vez" />
        </div>
      </section>

      <SubmitButton disabled={!slot || !complete} pendingText="Agendando...">Confirmar agendamento</SubmitButton>
    </form>
  );
}

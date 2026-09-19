"use client";

import { useMemo, useState } from "react";
import { SlotPicker } from "@/components/slot-picker";
import { formatCents } from "@/lib/money";
import { fmtDateKeyLong, minutesToHHMM } from "@/lib/dates";
import { computeBookingTotals } from "@/lib/services/addons";
import { computeDepositCents } from "@/lib/payments/deposit";
import { CATEGORY_ICONS, CATEGORY_LABELS, groupByCategory } from "@/lib/services/categories";
import type { DepositMode, ServiceCategory } from "@/generated/prisma/enums";
import type { PolicyItem } from "@/lib/policies";

type Service = {
  id: string; name: string; category: ServiceCategory; description: string | null; clientNotes: string | null;
  durationMinutes: number; priceCents: number; imageUrl: string | null; depositCents: number;
};
type AddOn = { id: string; name: string; description: string | null; clientNotes: string | null; durationMinutes: number; priceCents: number };
type Slot = { dateKey: string; minutes: number };
type Professional = { id: string; name: string; photoUrl: string | null; bio: string | null; serviceIds: string[] };

type Props = {
  slug: string; todayKey: string; maxAdvanceDays: number; requireConfirmation: boolean;
  requirePolicyAcceptance: boolean; policies: PolicyItem[];
  services: Service[]; addOns: AddOn[]; professionals: Professional[];
  depositMode: DepositMode; depositValue: number;
};

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Fluxo da cliente (seção 5): procedimento → adicionais + data/horário → seus dados → confirmação.
 * Estado vive só no cliente; o servidor valida tudo de novo no POST.
 */
export function BookingWizard({ slug, todayKey, maxAdvanceDays, requireConfirmation, requirePolicyAcceptance, policies, services, addOns, professionals, depositMode, depositValue }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [service, setService] = useState<Service | null>(services.length === 1 ? services[0] : null);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null); // null = qualquer profissional
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: string; professionalName?: string } | null>(null);

  const chosenAddOns = useMemo(() => addOns.filter((a) => addOnIds.includes(a.id)), [addOns, addOnIds]);
  const totals = service ? computeBookingTotals(service, chosenAddOns) : null;
  const depositCents = totals ? computeDepositCents({ depositMode, depositValue }, totals.priceCents) : 0;
  const grouped = useMemo(() => groupByCategory(services), [services]);

  const reset = () => { setDone(null); setStep(1); setSlot(null); setAddOnIds([]); setAccepted(false); setService(services.length === 1 ? services[0] : null); };

  if (done && service && totals) {
    const confirmed = done.status === "CONFIRMED";
    return (
      <div className="py-6 text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${confirmed ? "bg-emerald-100" : "bg-brand-100"}`}>{confirmed ? "✨" : "💬"}</div>
        <h2 className="mt-4 font-display text-2xl font-semibold">{confirmed ? "Horário confirmado!" : "Quase lá!"}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {confirmed
            ? "Enviamos os detalhes para o seu WhatsApp. Estamos te esperando! 💅"
            : "Enviamos uma mensagem no seu WhatsApp. Toque em Confirmar para garantir seu horário."}
        </p>
        <div className="mt-6 space-y-1 rounded-2xl bg-brand-50/60 p-4 text-left text-sm">
          <p><span className="text-zinc-500">Procedimento:</span> {service.name}</p>
          {chosenAddOns.length > 0 && <p><span className="text-zinc-500">Adicionais:</span> {chosenAddOns.map((a) => a.name).join(", ")}</p>}
          {done.professionalName && <p><span className="text-zinc-500">Profissional:</span> {done.professionalName}</p>}
          <p><span className="text-zinc-500">Quando:</span> {slot && fmtDateKeyLong(slot.dateKey)} às {slot && minutesToHHMM(slot.minutes)}</p>
          <p><span className="text-zinc-500">Duração:</span> {fmtDuration(totals.durationMinutes)}</p>
          <p><span className="text-zinc-500">Valor:</span> {formatCents(totals.priceCents)}</p>
        </div>
        <button className="btn-secondary mt-6 w-full" onClick={reset}>Fazer outro agendamento</button>
      </div>
    );
  }

  const eligible = service ? professionals.filter((p) => p.serviceIds.includes(service.id)) : [];
  const toggleAddOn = (id: string) => { setAddOnIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])); setSlot(null); };

  const submit = async () => {
    if (!service || !slot) return;
    if (requirePolicyAcceptance && !accepted) { setError("Para agendar, é preciso aceitar as políticas de atendimento."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id, addOnIds, acceptPolicies: accepted,
          professionalId: eligible.length === 1 ? eligible[0].id : professionalId,
          dateKey: slot.dateKey, minutes: slot.minutes, ...form,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; status?: string; error?: string; code?: string; professionalName?: string; paymentUrl?: string | null };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Não foi possível agendar. Tente novamente.");
        if (json.code === "SLOT_UNAVAILABLE") { setSlot(null); setStep(2); }
        return;
      }
      if (json.paymentUrl) { window.location.assign(json.paymentUrl); return; }
      setDone({ status: json.status ?? "PENDING", professionalName: json.professionalName });
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Steps current={step} />

      {step === 1 && (
        <div className="space-y-6">
          <h2 className="font-display text-2xl font-semibold text-brand-950">Escolha o procedimento</h2>
          {grouped.map((g) => (
            <section key={g.category}>
              {grouped.length > 1 && (
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700">
                  <span>{CATEGORY_ICONS[g.category]}</span> {CATEGORY_LABELS[g.category]}
                </h3>
              )}
              <div className="space-y-2">
                {g.items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setService(s); setSlot(null); setAddOnIds([]); setStep(2); }}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${service?.id === s.id ? "border-brand-500 bg-brand-50/60" : "border-zinc-200 hover:border-brand-300"}`}
                  >
                    {s.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">{CATEGORY_ICONS[s.category]}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900">{s.name}</p>
                      {s.description && <p className="line-clamp-2 text-xs text-zinc-500">{s.description}</p>}
                      <p className="mt-1 text-xs text-zinc-500">
                        ⏱ {fmtDuration(s.durationMinutes)}
                        {s.depositCents > 0 && <span className="ml-2 rounded-full bg-violet-50 px-1.5 py-0.5 text-violet-800">sinal {formatCents(s.depositCents)}</span>}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-brand-800">{formatCents(s.priceCents)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {step === 2 && service && totals && (
        <div>
          <Summary service={service} addOns={chosenAddOns} totals={totals} onEdit={() => setStep(1)} />
          {service.clientNotes && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">💡 {service.clientNotes}</p>
          )}

          {addOns.length > 0 && (
            <>
              <h2 className="mb-1 mt-6 font-display text-2xl font-semibold text-brand-950">Quer adicionar?</h2>
              <p className="mb-3 text-xs text-zinc-500">Opcional. Cada adicional soma tempo e valor ao seu atendimento.</p>
              <div className="space-y-2">
                {addOns.map((a) => {
                  const on = addOnIds.includes(a.id);
                  return (
                    <label key={a.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm transition ${on ? "border-brand-500 bg-brand-50/60" : "border-zinc-200 hover:border-brand-300"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleAddOn(a.id)} className="h-4 w-4 rounded border-zinc-300 accent-brand-600" />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{a.name}</span>
                        {a.description && <span className="block text-xs text-zinc-500">{a.description}</span>}
                        {on && a.clientNotes && <span className="mt-1 block text-xs text-amber-800">💡 {a.clientNotes}</span>}
                      </span>
                      <span className="shrink-0 text-right text-xs text-zinc-500">
                        <span className="block font-semibold text-brand-800">+ {formatCents(a.priceCents)}</span>
                        {a.durationMinutes > 0 && <span>+ {fmtDuration(a.durationMinutes)}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {eligible.length > 1 && (
            <>
              <h2 className="mb-3 mt-6 font-display text-2xl font-semibold text-brand-950">Com quem?</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <ProfessionalChip label="Qualquer" hint="primeira livre" selected={professionalId === null} onClick={() => { setProfessionalId(null); setSlot(null); }} />
                {eligible.map((p) => (
                  <ProfessionalChip key={p.id} label={p.name} photoUrl={p.photoUrl} selected={professionalId === p.id} onClick={() => { setProfessionalId(p.id); setSlot(null); }} />
                ))}
              </div>
            </>
          )}

          <h2 className="mb-3 mt-6 font-display text-2xl font-semibold text-brand-950">Escolha data e horário</h2>
          <SlotPicker
            slug={slug}
            serviceId={service.id}
            addOnIds={addOnIds}
            professionalId={eligible.length === 1 ? eligible[0].id : professionalId}
            todayKey={todayKey}
            maxAdvanceDays={maxAdvanceDays}
            value={slot}
            onChange={setSlot}
          />
          <button className="btn-accent mt-4 w-full rounded-xl py-3 text-base" disabled={!slot} onClick={() => setStep(3)}>
            Continuar
          </button>
        </div>
      )}

      {step === 3 && service && slot && totals && (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
          <Summary service={service} addOns={chosenAddOns} totals={totals} slot={slot} onEdit={() => setStep(2)} />
          <h2 className="mt-5 font-display text-2xl font-semibold text-brand-950">Seus dados</h2>
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}
          <div>
            <label className="label" htmlFor="name">Nome</label>
            <input id="name" required autoComplete="name" className="input rounded-xl py-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="phone">WhatsApp</label>
            <input id="phone" required inputMode="tel" autoComplete="tel" placeholder="(11) 99999-8888" className="input rounded-xl py-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <p className="mt-1 text-xs text-zinc-500">{requireConfirmation ? "Você receberá uma mensagem para confirmar o horário." : "Enviaremos a confirmação por WhatsApp."}</p>
          </div>
          <div>
            <label className="label" htmlFor="email">E-mail <span className="font-normal text-zinc-400">(opcional)</span></label>
            <input id="email" type="email" autoComplete="email" className="input rounded-xl py-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="notes">Observação <span className="font-normal text-zinc-400">(opcional)</span></label>
            <input id="notes" className="input rounded-xl py-3" maxLength={300} placeholder="Ex.: quero formato almond, tamanho médio" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {policies.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              <p className="mb-2 font-medium text-zinc-800">Políticas de atendimento</p>
              <ul className="space-y-1">
                {policies.map((p) => <li key={p.title}>{p.icon} <span className="font-medium">{p.title}:</span> {p.text}</li>)}
              </ul>
              {requirePolicyAcceptance && (
                <label className="mt-3 flex items-start gap-2 text-sm text-zinc-800">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-brand-600" />
                  Li e aceito as políticas de atendimento.
                </label>
              )}
            </div>
          )}

          {depositCents > 0 && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
              Para confirmar seu horário, é necessário o pagamento de um <strong>sinal de {formatCents(depositCents)}</strong> via Pix na próxima tela.
              {depositCents < totals.priceCents && " O restante é pago no atendimento."}
            </div>
          )}
          <button type="submit" className="btn-accent w-full rounded-xl py-3 text-base" disabled={submitting || (requirePolicyAcceptance && !accepted)}>
            {submitting ? "Agendando..." : depositCents > 0 ? "Continuar para o pagamento" : "Confirmar solicitação"}
          </button>
        </form>
      )}
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const labels = ["Procedimento", "Horário", "Seus dados"];
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs">
      {labels.map((l, i) => {
        const n = i + 1;
        return (
          <li key={l} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full font-medium ${n === current ? "bg-brand-600 text-white" : n < current ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"}`}>
              {n < current ? "✓" : n}
            </span>
            <span className={n === current ? "font-medium text-zinc-900" : "text-zinc-400"}>{l}</span>
            {n < labels.length && <span className="mx-1 h-px w-4 bg-zinc-200" />}
          </li>
        );
      })}
    </ol>
  );
}

function Summary({ service, addOns, totals, slot, onEdit }: { service: Service; addOns: AddOn[]; totals: { durationMinutes: number; priceCents: number }; slot?: Slot; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-brand-50/60 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{service.name}{addOns.length > 0 && <span className="text-zinc-500"> + {addOns.map((a) => a.name).join(", ")}</span>}</p>
        <p className="text-xs text-zinc-500">
          {fmtDuration(totals.durationMinutes)} · {formatCents(totals.priceCents)}
          {slot && <> · {fmtDateKeyLong(slot.dateKey)} às {minutesToHHMM(slot.minutes)}</>}
        </p>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-xs font-medium text-brand-700 hover:underline">Alterar</button>
    </div>
  );
}

function ProfessionalChip({ label, hint, photoUrl, selected, onClick }: { label: string; hint?: string; photoUrl?: string | null; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm transition ${
        selected ? "border-brand-700 bg-brand-700 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-brand-300"
      }`}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${selected ? "bg-white/20" : "bg-brand-100 text-brand-800"}`}>
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span>
        {label}
        {hint && <span className={`ml-1 text-xs ${selected ? "text-brand-200" : "text-zinc-400"}`}>· {hint}</span>}
      </span>
    </button>
  );
}

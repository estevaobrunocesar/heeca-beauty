"use client";

import { useMemo, useState } from "react";
import { SlotPicker, type SlotPickerItem } from "@/components/slot-picker";
import { formatCents } from "@/lib/money";
import { fmtDateKeyLong, minutesToHHMM } from "@/lib/dates";
import { computeBookingTotals } from "@/lib/services/addons";
import { computeDepositCents } from "@/lib/payments/deposit";
import { categoryIcon, groupByCategory, UNCATEGORIZED_LABEL, type CategoryRef } from "@/lib/services/categories";
import type { DepositMode } from "@/generated/prisma/enums";
import type { PolicyItem } from "@/lib/policies";

type Service = {
  id: string; name: string; categoryId: string | null; description: string | null; clientNotes: string | null;
  durationMinutes: number; priceCents: number; imageUrl: string | null; depositCents: number;
};
type AddOn = { id: string; name: string; description: string | null; clientNotes: string | null; durationMinutes: number; priceCents: number };
type Slot = { dateKey: string; minutes: number };
type Professional = { id: string; name: string; photoUrl: string | null; bio: string | null; serviceIds: string[] };

/** Um serviço escolhido pela cliente, com adicionais e preferência de profissional (SPEC §11). */
type VisitItem = { serviceId: string; addOnIds: string[]; professionalId: string | null };

type Props = {
  slug: string; todayKey: string; maxAdvanceDays: number; requireConfirmation: boolean;
  requirePolicyAcceptance: boolean; policies: PolicyItem[];
  categories: CategoryRef[]; services: Service[]; addOns: AddOn[]; professionals: Professional[];
  depositMode: DepositMode; depositValue: number;
};

const MAX_ITEMS = 6;

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Fluxo da cliente (SPEC §10–11): serviços → profissional/adicionais por serviço + data/horário → seus dados.
 * Estado vive só no cliente; o servidor valida tudo de novo no POST.
 */
export function BookingWizard({ slug, todayKey, maxAdvanceDays, requireConfirmation, requirePolicyAcceptance, policies, categories, services, addOns, professionals, depositMode, depositValue }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<VisitItem[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: string; professionalName?: string } | null>(null);

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const addOnById = useMemo(() => new Map(addOns.map((a) => [a.id, a])), [addOns]);
  const grouped = useMemo(() => groupByCategory(services, categories), [services, categories]);

  // Cada item com seu serviço, adicionais escolhidos, totais e profissionais habilitados.
  const resolved = useMemo(() => items.map((it) => {
    const service = serviceById.get(it.serviceId)!;
    const chosenAddOns = it.addOnIds.map((id) => addOnById.get(id)!).filter(Boolean);
    const eligible = professionals.filter((p) => p.serviceIds.includes(service.id));
    return { ...it, service, chosenAddOns, totals: computeBookingTotals(service, chosenAddOns), eligible };
  }), [items, serviceById, addOnById, professionals]);
  const totals = resolved.reduce((acc, r) => ({ durationMinutes: acc.durationMinutes + r.totals.durationMinutes, priceCents: acc.priceCents + r.totals.priceCents }), { durationMinutes: 0, priceCents: 0 });
  const depositCents = computeDepositCents({ depositMode, depositValue }, totals.priceCents);
  const pickerItems: SlotPickerItem[] = resolved.map((r) => ({
    serviceId: r.serviceId, addOnIds: r.addOnIds,
    // Único habilitado = já decidido; senão respeita a escolha (null = qualquer).
    professionalId: r.eligible.length === 1 ? r.eligible[0].id : r.professionalId,
  }));

  const reset = () => { setDone(null); setStep(1); setSlot(null); setItems([]); setAccepted(false); };
  const toggleService = (id: string) => {
    setSlot(null);
    setItems((list) => list.some((i) => i.serviceId === id)
      ? list.filter((i) => i.serviceId !== id)
      : list.length >= MAX_ITEMS ? list : [...list, { serviceId: id, addOnIds: [], professionalId: null }]);
  };
  const updateItem = (index: number, patch: Partial<VisitItem>) => {
    setSlot(null);
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const moveItem = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    setSlot(null);
    setItems((list) => { const next = [...list]; [next[index], next[j]] = [next[j], next[index]]; return next; });
  };

  if (done && resolved.length > 0) {
    const confirmed = done.status === "CONFIRMED";
    return (
      <div className="py-6 text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${confirmed ? "bg-emerald-100" : "bg-brand-100"}`}>{confirmed ? "✨" : "💬"}</div>
        <h2 className="mt-4 font-display text-2xl font-semibold">{confirmed ? "Horário confirmado!" : "Quase lá!"}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {confirmed
            ? "Enviamos os detalhes para o seu WhatsApp. Estamos te esperando! 💜"
            : "Enviamos uma mensagem no seu WhatsApp. Toque em Confirmar para garantir seu horário."}
        </p>
        <div className="mt-6 space-y-1 rounded-2xl bg-brand-50/60 p-4 text-left text-sm">
          <p><span className="text-zinc-500">{resolved.length > 1 ? "Serviços" : "Serviço"}:</span> {resolved.map((r) => r.service.name).join(" + ")}</p>
          {resolved.some((r) => r.chosenAddOns.length > 0) && (
            <p><span className="text-zinc-500">Adicionais:</span> {resolved.flatMap((r) => r.chosenAddOns.map((a) => a.name)).join(", ")}</p>
          )}
          {done.professionalName && <p><span className="text-zinc-500">{done.professionalName.includes(" e ") ? "Profissionais" : "Profissional"}:</span> {done.professionalName}</p>}
          <p><span className="text-zinc-500">Quando:</span> {slot && fmtDateKeyLong(slot.dateKey)} às {slot && minutesToHHMM(slot.minutes)}</p>
          <p><span className="text-zinc-500">Duração:</span> {fmtDuration(totals.durationMinutes)}</p>
          <p><span className="text-zinc-500">Valor:</span> {formatCents(totals.priceCents)}</p>
        </div>
        <button className="btn-secondary mt-6 w-full" onClick={reset}>Fazer outro agendamento</button>
      </div>
    );
  }

  const submit = async () => {
    if (resolved.length === 0 || !slot) return;
    if (requirePolicyAcceptance && !accepted) { setError("Para agendar, é preciso aceitar as políticas de atendimento."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: pickerItems, acceptPolicies: accepted, dateKey: slot.dateKey, minutes: slot.minutes, ...form }),
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
        <div className="space-y-6 pb-24">
          <div>
            <h2 className="font-display text-2xl font-semibold text-brand-950">O que você quer fazer?</h2>
            <p className="mt-1 text-xs text-zinc-500">Escolha um ou mais serviços — dá para fazer tudo na mesma visita.</p>
          </div>
          {grouped.map((g) => (
            <section key={g.category?.id ?? "sem-categoria"}>
              {grouped.length > 1 && (
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700">
                  <span>{g.category ? categoryIcon(g.category.slug) : "✨"}</span> {g.category?.name ?? UNCATEGORIZED_LABEL}
                </h3>
              )}
              <div className="space-y-2">
                {g.items.map((s) => {
                  const on = items.some((i) => i.serviceId === s.id);
                  const icon = g.category ? categoryIcon(g.category.slug) : "✨";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleService(s.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${on ? "border-brand-500 bg-brand-50/60" : "border-zinc-200 hover:border-brand-300"}`}
                    >
                      {s.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">{icon}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900">{s.name}</p>
                        {s.description && <p className="line-clamp-2 text-xs text-zinc-500">{s.description}</p>}
                        <p className="mt-1 text-xs text-zinc-500">
                          ⏱ {fmtDuration(s.durationMinutes)}
                          {s.depositCents > 0 && <span className="ml-2 rounded-full bg-violet-50 px-1.5 py-0.5 text-violet-800">sinal {formatCents(s.depositCents)}</span>}
                        </p>
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold text-brand-800">{formatCents(s.priceCents)}</span>
                        <span className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${on ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300 text-transparent"}`}>✓</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Barra fixa com o total da visita */}
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur">
            <div className="mx-auto flex max-w-md items-center gap-3">
              <div className="min-w-0 flex-1 text-sm">
                {items.length === 0 ? (
                  <span className="text-zinc-500">Nenhum serviço escolhido</span>
                ) : (
                  <>
                    <span className="font-medium">{items.length} {items.length === 1 ? "serviço" : "serviços"}</span>
                    <span className="text-zinc-500"> · {fmtDuration(totals.durationMinutes)} · {formatCents(totals.priceCents)}</span>
                  </>
                )}
              </div>
              <button className="btn-accent rounded-xl px-5 py-2.5" disabled={items.length === 0} onClick={() => setStep(2)}>Continuar</button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && resolved.length > 0 && (
        <div>
          <VisitSummary resolved={resolved} totals={totals} onEdit={() => setStep(1)} />

          <h2 className="mb-1 mt-6 font-display text-2xl font-semibold text-brand-950">{resolved.length > 1 ? "Seus serviços" : "Seu serviço"}</h2>
          {resolved.length > 1 && <p className="mb-3 text-xs text-zinc-500">Nesta ordem, um depois do outro. Toque nas setas para reorganizar.</p>}
          <div className="space-y-3">
            {resolved.map((r, index) => (
              <div key={r.serviceId} className="rounded-2xl border border-zinc-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900">{resolved.length > 1 && <span className="mr-1 text-zinc-400">{index + 1}.</span>}{r.service.name}</p>
                    <p className="text-xs text-zinc-500">{fmtDuration(r.totals.durationMinutes)} · {formatCents(r.totals.priceCents)}</p>
                  </div>
                  {resolved.length > 1 && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" className="btn-ghost px-2 py-1" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label="Mover para cima">↑</button>
                      <button type="button" className="btn-ghost px-2 py-1" disabled={index === resolved.length - 1} onClick={() => moveItem(index, 1)} aria-label="Mover para baixo">↓</button>
                    </div>
                  )}
                </div>
                {r.service.clientNotes && (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">💡 {r.service.clientNotes}</p>
                )}

                {addOns.length > 0 && (
                  <details className="mt-2" open={r.addOnIds.length > 0}>
                    <summary className="cursor-pointer text-xs font-medium text-brand-700">
                      Adicionais {r.addOnIds.length > 0 ? `(${r.addOnIds.length})` : "(opcional)"}
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {addOns.map((a) => {
                        const on = r.addOnIds.includes(a.id);
                        return (
                          <label key={a.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-sm transition ${on ? "border-brand-500 bg-brand-50/60" : "border-zinc-200 hover:border-brand-300"}`}>
                            <input
                              type="checkbox" checked={on} className="h-4 w-4 rounded border-zinc-300 accent-brand-600"
                              onChange={() => updateItem(index, { addOnIds: on ? r.addOnIds.filter((x) => x !== a.id) : [...r.addOnIds, a.id] })}
                            />
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
                  </details>
                )}

                {r.eligible.length > 1 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-zinc-700">Com quem?</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      <ProfessionalChip label="Qualquer" hint="quem estiver livre" selected={r.professionalId === null} onClick={() => updateItem(index, { professionalId: null })} />
                      {r.eligible.map((p) => (
                        <ProfessionalChip key={p.id} label={p.name} photoUrl={p.photoUrl} selected={r.professionalId === p.id} onClick={() => updateItem(index, { professionalId: p.id })} />
                      ))}
                    </div>
                  </div>
                )}
                {r.eligible.length === 1 && professionals.length > 1 && (
                  <p className="mt-2 text-xs text-zinc-500">Com {r.eligible[0].name}</p>
                )}
              </div>
            ))}
          </div>

          <h2 className="mb-3 mt-6 font-display text-2xl font-semibold text-brand-950">Escolha data e horário</h2>
          <SlotPicker slug={slug} items={pickerItems} todayKey={todayKey} maxAdvanceDays={maxAdvanceDays} value={slot} onChange={setSlot} />
          <button className="btn-accent mt-4 w-full rounded-xl py-3 text-base" disabled={!slot} onClick={() => setStep(3)}>
            Continuar
          </button>
        </div>
      )}

      {step === 3 && resolved.length > 0 && slot && (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
          <VisitSummary resolved={resolved} totals={totals} slot={slot} onEdit={() => setStep(2)} />
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
            <input id="notes" className="input rounded-xl py-3" maxLength={300} placeholder="Ex.: tenho o cabelo com química recente" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
  const labels = ["Serviços", "Horário", "Seus dados"];
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

type ResolvedItem = { service: Service; chosenAddOns: AddOn[] };

function VisitSummary({ resolved, totals, slot, onEdit }: { resolved: ResolvedItem[]; totals: { durationMinutes: number; priceCents: number }; slot?: Slot; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-brand-50/60 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">
          {resolved.map((r, i) => (
            <span key={r.service.id}>
              {i > 0 && <span className="text-zinc-400"> + </span>}
              {r.service.name}
              {r.chosenAddOns.length > 0 && <span className="text-zinc-500"> (+ {r.chosenAddOns.map((a) => a.name).join(", ")})</span>}
            </span>
          ))}
        </p>
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

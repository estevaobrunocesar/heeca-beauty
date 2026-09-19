"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, format, getDaysInMonth, parse, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { minutesToHHMM, ucfirst } from "@/lib/dates";

type Props = {
  slug: string;
  serviceId?: string;
  addOnIds?: string[]; // adicionais escolhidos (somam à duração)
  durationMinutes?: number;
  excludeAppointmentId?: string;
  professionalId?: string | null; // null/undefined = qualquer profissional
  todayKey: string; // no fuso do tenant, calculado no servidor
  maxAdvanceDays: number;
  value?: { dateKey: string; minutes: number } | null;
  onChange: (v: { dateKey: string; minutes: number } | null) => void;
};

/**
 * Calendário mensal + lista de horários. Consulta a API pública de disponibilidade,
 * que usa exatamente a mesma função de cálculo usada na validação do agendamento.
 */
export function SlotPicker({ slug, serviceId, addOnIds, durationMinutes, excludeAppointmentId, professionalId, todayKey, maxAdvanceDays, value, onChange }: Props) {
  const addOnsKey = addOnIds?.join(",") ?? "";
  const [month, setMonth] = useState(() => startOfMonth(parse(value?.dateKey ?? todayKey, "yyyy-MM-dd", new Date())));
  const [selectedDay, setSelectedDay] = useState<string | null>(value?.dateKey ?? null);
  // Cache keyed pelo que foi consultado: "carregando" = a chave atual ainda não está no cache.
  const [daysCache, setDaysCache] = useState<{ key: string; days: Set<string> } | null>(null);
  const [slotsCache, setSlotsCache] = useState<{ key: string; slots: { minutes: number }[] } | null>(null);

  const monthKey = format(month, "yyyy-MM-dd");
  const lastKey = format(addDays(parse(todayKey, "yyyy-MM-dd", new Date()), maxAdvanceDays), "yyyy-MM-dd");

  const baseQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (serviceId) p.set("serviceId", serviceId);
    else if (durationMinutes) p.set("duration", String(durationMinutes));
    if (addOnsKey) p.set("addOns", addOnsKey);
    if (excludeAppointmentId) p.set("exclude", excludeAppointmentId);
    if (professionalId) p.set("professionalId", professionalId);
    return p;
  }, [serviceId, addOnsKey, durationMinutes, excludeAppointmentId, professionalId]);

  const daysKey = `${monthKey}|${baseQuery}`;
  const slotsKey = selectedDay ? `${selectedDay}|${baseQuery}` : null;
  const days = daysCache?.key === daysKey ? daysCache.days : null;
  const slots = slotsKey && slotsCache?.key === slotsKey ? slotsCache.slots : null;

  // Dias com vaga no mês visível
  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams(baseQuery);
    p.set("from", monthKey);
    p.set("to", format(endOfMonth(month), "yyyy-MM-dd"));
    fetch(`/api/public/${slug}/slots?${p}`)
      .then((r) => r.json())
      .then((j: { days?: string[] }) => { if (!cancelled) setDaysCache({ key: daysKey, days: new Set(j.days ?? []) }); })
      .catch(() => { if (!cancelled) setDaysCache({ key: daysKey, days: new Set() }); });
    return () => { cancelled = true; };
  }, [slug, baseQuery, monthKey, month, daysKey]);

  // Horários do dia selecionado
  useEffect(() => {
    if (!slotsKey || !selectedDay) return;
    let cancelled = false;
    const p = new URLSearchParams(baseQuery);
    p.set("date", selectedDay);
    fetch(`/api/public/${slug}/slots?${p}`)
      .then((r) => r.json())
      .then((j: { slots?: { minutes: number }[] }) => { if (!cancelled) setSlotsCache({ key: slotsKey, slots: j.slots ?? [] }); })
      .catch(() => { if (!cancelled) setSlotsCache({ key: slotsKey, slots: [] }); });
    return () => { cancelled = true; };
  }, [slug, baseQuery, selectedDay, slotsKey]);

  const lead = (month.getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: getDaysInMonth(month) }, (_, i) => format(addDays(month, i), "yyyy-MM-dd"))];

  const canPrev = format(addMonths(month, -1), "yyyy-MM") >= todayKey.slice(0, 7);
  const canNext = format(addMonths(month, 1), "yyyy-MM") <= lastKey.slice(0, 7);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_200px]">
      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" disabled={!canPrev} className="btn-ghost px-2 py-1" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
          <span className="text-sm font-medium">{ucfirst(format(month, "MMMM yyyy", { locale: ptBR }))}</span>
          <button type="button" disabled={!canNext} className="btn-ghost px-2 py-1" onClick={() => setMonth(addMonths(month, 1))}>›</button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] text-zinc-500">
          {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((k, i) => {
            if (!k) return <div key={i} />;
            const available = days?.has(k) ?? false;
            const selected = k === selectedDay;
            const past = k < todayKey || k > lastKey;
            return (
              <button
                key={k}
                type="button"
                disabled={!available || days === null}
                onClick={() => { setSelectedDay(k); onChange(null); }}
                className={`aspect-square rounded-lg text-sm transition ${
                  selected ? "bg-zinc-900 font-semibold text-white"
                  : available ? "bg-brand-50 font-medium text-brand-800 hover:bg-brand-100"
                  : past ? "text-zinc-300" : "text-zinc-400 line-through decoration-zinc-300"
                } ${days === null ? "animate-pulse" : ""}`}
              >
                {Number(k.slice(8))}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card max-h-80 overflow-y-auto p-3">
        {!selectedDay ? (
          <p className="py-6 text-center text-sm text-zinc-500">Escolha um dia</p>
        ) : slots === null ? (
          <p className="py-6 text-center text-sm text-zinc-400">Carregando...</p>
        ) : slots.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Sem horários neste dia</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-2">
            {slots.map((s) => {
              const active = value?.dateKey === selectedDay && value.minutes === s.minutes;
              return (
                <button
                  key={s.minutes}
                  type="button"
                  onClick={() => onChange({ dateKey: selectedDay, minutes: s.minutes })}
                  className={`rounded-lg border px-2 py-1.5 text-sm tabular-nums transition ${
                    active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:border-zinc-400"
                  }`}
                >
                  {minutesToHHMM(s.minutes)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

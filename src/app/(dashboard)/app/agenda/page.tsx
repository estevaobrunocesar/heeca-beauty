import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { addDaysToKey, dateKeyToDate, fmtDateKeyLong, todayKey, toDateKey, weekdayOfKey, zonedDateTimeToUtc, WEEKDAY_SHORT, minutesToHHMM, ucfirst } from "@/lib/dates";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/ui/page-header";
import { ACTIVE_STATUSES } from "@/lib/appointments/status";
import { AppointmentCard } from "@/components/dashboard/appointment-card";
import { Avatar } from "@/components/dashboard/avatar";
import { ScheduleManager } from "./schedule-manager";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { cardInclude, withProfessionals } from "@/lib/appointments/queries";

export const metadata: Metadata = { title: "Agenda" };

type View = "day" | "week" | "month";

export default async function AgendaPage({ searchParams }: PageProps<"/app/agenda">) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const { tenant } = ctx;
  const tz = tenant.timezone;
  const view: View = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const today = todayKey(tz);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  // Filtro de profissional: OWNER vê todos por padrão; STAFF só o próprio.
  const team = ctx.professionals;
  const showTeam = ctx.isOwner && team.length > 1;
  const requestedPro = typeof sp.pro === "string" ? team.find((p) => p.id === sp.pro) : undefined;
  const selected = ctx.isOwner ? requestedPro ?? null : ctx.professional; // null = todos
  const proIds = selected ? [selected.id] : team.map((p) => p.id);
  const proName = new Map(team.map((p) => [p.id, p]));

  // Intervalo de dias (chaves) coberto pela visão atual
  let fromKey = date;
  let toKey = date;
  if (view === "week") {
    const d = dateKeyToDate(date);
    fromKey = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    toKey = format(endOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  } else if (view === "month") {
    const d = dateKeyToDate(date);
    fromKey = format(startOfMonth(d), "yyyy-MM-dd");
    toKey = format(endOfMonth(d), "yyyy-MM-dd");
  }
  const fromUtc = zonedDateTimeToUtc(fromKey, 0, tz);
  const toUtc = zonedDateTimeToUtc(addDaysToKey(toKey, 1), 0, tz);

  const [appointments, blocks, exceptions] = await Promise.all([
    db.appointment.findMany({
      where: { tenantId: tenant.id, ...withProfessionals(proIds), startsAt: { gte: fromUtc, lt: toUtc } },
      include: cardInclude,
      orderBy: { startsAt: "asc" },
    }),
    db.scheduleBlock.findMany({ where: { professionalId: { in: proIds }, startsAt: { lt: toUtc }, endsAt: { gt: fromUtc } }, orderBy: { startsAt: "asc" } }),
    db.scheduleException.findMany({ where: { professionalId: { in: proIds }, date: { gte: dateKeyToDate(fromKey), lte: dateKeyToDate(toKey) } }, orderBy: { date: "asc" } }),
  ]);

  const byDay = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const k = toDateKey(a.startsAt, tz);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  // Exceções por dia: com vários profissionais pode haver mais de uma
  const exceptionsByKey = new Map<string, typeof exceptions>();
  for (const e of exceptions) {
    const k = e.date.toISOString().slice(0, 10);
    exceptionsByKey.set(k, [...(exceptionsByKey.get(k) ?? []), e]);
  }
  const allClosed = (k: string) => {
    const list = exceptionsByKey.get(k) ?? [];
    return list.length === proIds.length && list.every((e) => e.kind === "CLOSED");
  };

  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const prev = view === "month" ? format(new Date(dateKeyToDate(date).setMonth(dateKeyToDate(date).getMonth() - 1)), "yyyy-MM-dd") : addDaysToKey(date, -step);
  const next = view === "month" ? format(new Date(dateKeyToDate(date).setMonth(dateKeyToDate(date).getMonth() + 1)), "yyyy-MM-dd") : addDaysToKey(date, step);
  const proQ = selected && ctx.isOwner ? `&pro=${selected.id}` : "";
  const href = (v: View, d: string, pro: string | null | undefined = undefined) =>
    `/app/agenda?view=${v}&date=${d}${pro === undefined ? proQ : pro ? `&pro=${pro}` : ""}`;
  const showProOnCards = !selected && team.length > 1;

  const title =
    view === "day" ? fmtDateKeyLong(date)
    : view === "week" ? `Semana de ${format(dateKeyToDate(fromKey), "d MMM", { locale: ptBR })} a ${format(dateKeyToDate(toKey), "d MMM", { locale: ptBR })}`
    : ucfirst(format(dateKeyToDate(date), "MMMM 'de' yyyy", { locale: ptBR }));

  return (
    <>
      <PageHeader
        title="Agenda"
        actions={<Link href={`/app/agenda/novo${selected ? `?pro=${selected.id}` : ""}`} className="btn-primary">+ Agendar</Link>}
      />

      {showTeam && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={href(view, date, null)} className={`btn ${!selected ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"} px-3 py-1.5 text-xs`}>
            Toda a equipe
          </Link>
          {team.map((p) => (
            <Link key={p.id} href={href(view, date, p.id)} className={`btn gap-1.5 py-1 pl-1.5 pr-3 text-xs ${selected?.id === p.id ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"} ${p.active ? "" : "opacity-60"}`}>
              <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
              {p.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link href={href(view, prev)} className="btn-secondary px-3" aria-label="Anterior">‹</Link>
          <Link href={href(view, today)} className="btn-secondary">Hoje</Link>
          <Link href={href(view, next)} className="btn-secondary px-3" aria-label="Próximo">›</Link>
          <span className="ml-2 text-sm font-medium text-zinc-800">{title}</span>
        </div>
        <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm">
          {(["day", "week", "month"] as View[]).map((v) => (
            <Link key={v} href={href(v, date)} className={`rounded-md px-3 py-1 ${view === v ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>
      </div>

      {view === "day" && (
        <div className="space-y-3">
          {(exceptionsByKey.get(date) ?? []).map((e) => (
            <div key={e.id} className={`rounded-lg border px-4 py-2 text-sm ${e.kind === "CLOSED" ? "border-zinc-200 bg-zinc-100 text-zinc-600" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
              {team.length > 1 && <span className="font-medium">{proName.get(e.professionalId)?.name}: </span>}
              {e.kind === "CLOSED" ? "Folga" : `Horário excepcional ${minutesToHHMM(e.startMinutes ?? 0)}–${minutesToHHMM(e.endMinutes ?? 0)}`}
              {e.reason ? ` · ${e.reason}` : ""}
            </div>
          ))}
          {blocks
            .filter((b) => toDateKey(b.startsAt, tz) <= date && toDateKey(b.endsAt, tz) >= date)
            .map((b) => (
              <div key={b.id} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                {team.length > 1 && <span className="font-medium">{proName.get(b.professionalId)?.name}: </span>}
                {b.kind === "VACATION" ? "Férias" : "Bloqueio"}{b.reason ? ` · ${b.reason}` : ""}
              </div>
            ))}
          {(byDay.get(date) ?? []).length === 0 ? (
            <div className="card px-6 py-10 text-center text-sm text-zinc-500">Nenhum agendamento neste dia.</div>
          ) : (
            (byDay.get(date) ?? []).map((a) => <AppointmentCard key={a.id} appointment={a} tz={tz} showProfessional={showProOnCards} />)
          )}
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDaysToKey(fromKey, i)).map((k) => {
            const list = byDay.get(k) ?? [];
            return (
              <div key={k} className={`card min-h-28 p-2 ${k === today ? "ring-2 ring-brand-300" : ""}`}>
                <Link href={href("day", k)} className="mb-2 flex items-baseline justify-between px-1 text-xs hover:underline">
                  <span className="font-medium">{WEEKDAY_SHORT[weekdayOfKey(k)]}</span>
                  <span className="text-zinc-500">{k.slice(8)}/{k.slice(5, 7)}</span>
                </Link>
                {allClosed(k) && <p className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] text-zinc-500">Folga</p>}
                <div className="space-y-1">
                  {list.map((a) => <AppointmentCard key={a.id} appointment={a} tz={tz} compact showProfessional={showProOnCards} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "month" && <MonthView dateKey={date} today={today} byDay={byDay} allClosed={allClosed} href={href} />}

      <div className="mt-10">
        <ScheduleManager
          tz={tz}
          professionals={team.map((p) => ({ id: p.id, name: p.name }))}
          defaultProfessionalId={selected?.id ?? ctx.professional.id}
          blocks={blocks.map((b) => ({ id: b.id, kind: b.kind, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), reason: b.reason, professionalName: team.length > 1 ? proName.get(b.professionalId)?.name ?? null : null }))}
          exceptions={exceptions.map((e) => ({
            id: e.id, date: e.date.toISOString().slice(0, 10), kind: e.kind, reason: e.reason,
            hours: e.kind === "CUSTOM_HOURS" ? `${minutesToHHMM(e.startMinutes ?? 0)}–${minutesToHHMM(e.endMinutes ?? 0)}` : null,
            professionalName: team.length > 1 ? proName.get(e.professionalId)?.name ?? null : null,
          }))}
          rangeLabel={view === "day" ? "neste dia" : view === "week" ? "nesta semana" : "neste mês"}
        />
      </div>
    </>
  );
}

type Appt = { id: string; status: AppointmentStatus };

function MonthView({ dateKey, today, byDay, allClosed, href }: {
  dateKey: string; today: string; byDay: Map<string, Appt[]>;
  allClosed: (k: string) => boolean; href: (v: View, d: string) => string;
}) {
  const first = startOfMonth(dateKeyToDate(dateKey));
  const firstKey = format(first, "yyyy-MM-dd");
  const daysInMonth = getDaysInMonth(first);
  const lead = (first.getDay() + 6) % 7; // segunda = 0
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDaysToKey(firstKey, i))];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium text-zinc-500">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((k, i) => {
          if (!k) return <div key={i} className="min-h-20 border-b border-r border-zinc-100 bg-zinc-50/50" />;
          const list = byDay.get(k) ?? [];
          const active = list.filter((a) => ACTIVE_STATUSES.includes(a.status)).length;
          const closed = allClosed(k);
          return (
            <Link key={k} href={href("day", k)} className={`min-h-20 border-b border-r border-zinc-100 p-1.5 text-xs hover:bg-zinc-50 ${closed ? "bg-zinc-50" : ""}`}>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${k === today ? "bg-zinc-900 font-semibold text-white" : "text-zinc-700"}`}>{Number(k.slice(8))}</span>
              {closed && <p className="mt-1 text-[10px] text-zinc-400">Folga</p>}
              {active > 0 && <p className="mt-1 rounded bg-emerald-100 px-1 py-0.5 text-[11px] text-emerald-800">{active} agend.</p>}
              {list.length - active > 0 && <p className="mt-0.5 text-[10px] text-zinc-400">{list.length - active} finaliz./canc.</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

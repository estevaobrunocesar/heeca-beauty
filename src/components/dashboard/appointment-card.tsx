import Link from "next/link";
import type { Appointment, Client } from "@/generated/prisma/client";
import { fmtTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { describeProfessionals } from "@/lib/appointments/summary";
import { StatusBadge } from "@/components/ui/status-badge";
import { QuickActions } from "./quick-actions";
import { Avatar } from "./avatar";

type CardItem = { serviceName: string; professional: { name: string; photoUrl: string | null }; addOns?: { name: string }[] };

type Props = {
  appointment: Appointment & { client: Client; items: CardItem[] };
  tz: string;
  compact?: boolean;
  showProfessional?: boolean;
};

export function AppointmentCard({ appointment: a, tz, compact, showProfessional }: Props) {
  const cancelled = a.status === "CANCELLED_BY_CLIENT" || a.status === "CANCELLED_BY_PROFESSIONAL";
  const addOns = a.items.flatMap((it) => it.addOns ?? []);
  // Profissionais da visita: mostrados quando a agenda é da equipe toda ou quando há mais de um na visita.
  const pros = [...new Map(a.items.map((it) => [it.professional.name, it.professional])).values()];
  const pro = showProfessional || pros.length > 1
    ? { name: describeProfessionals(a.items), photoUrl: pros.length === 1 ? pros[0].photoUrl : null }
    : null;

  if (compact) {
    return (
      <Link
        href={`/app/agendamentos/${a.id}`}
        className={`block rounded-md border-l-2 bg-zinc-50 px-2 py-1 text-xs hover:bg-zinc-100 ${
          a.status === "CONFIRMED" ? "border-emerald-500" : cancelled ? "border-zinc-300 opacity-60" : a.status === "COMPLETED" ? "border-sky-400" : a.status === "RESCHEDULE_REQUESTED" ? "border-orange-500" : "border-amber-400"
        }`}
      >
        <span className="font-medium">{fmtTime(a.startsAt, tz)}</span> {a.client.name.split(" ")[0]}
        <span className="block truncate text-zinc-500">{a.serviceName}{addOns.length ? " 💎" : ""}{pro ? ` · ${pro.name}` : ""}</span>
      </Link>
    );
  }

  return (
    <div className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${cancelled ? "opacity-70" : ""}`}>
      <div className="flex w-24 shrink-0 flex-col">
        <span className="text-lg font-semibold tabular-nums">{fmtTime(a.startsAt, tz)}</span>
        <span className="text-xs text-zinc-500">{a.durationMinutes} min · até {fmtTime(a.endsAt, tz)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/app/agendamentos/${a.id}`} className="font-medium hover:underline">{a.client.name}</Link>
          <StatusBadge status={a.status} />
        </div>
        <p className="text-sm text-zinc-600">
          {a.serviceName}
          {addOns.length > 0 && <span className="ml-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800" title={addOns.map((x) => x.name).join(", ")}>+ {addOns.length} adicional{addOns.length > 1 ? "is" : ""}</span>}
          {" "}· {formatCents(a.priceCents)} ·{" "}
          <a href={`https://wa.me/${a.client.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
            {formatPhone(a.client.phone)}
          </a>
        </p>
        {pro && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
            <Avatar name={pro.name} photoUrl={pro.photoUrl} size="sm" /> {pro.name}
          </p>
        )}
        {a.notes && <p className="mt-1 text-xs text-zinc-500">Obs.: {a.notes}</p>}
      </div>
      <QuickActions id={a.id} status={a.status} />
    </div>
  );
}

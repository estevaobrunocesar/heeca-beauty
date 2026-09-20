import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { StatusBadge } from "@/components/ui/status-badge";
import { ACTIVE_STATUSES } from "@/lib/appointments/status";
import { averageIntervalDays, isRecurring, predictReturn, returnMessage, RETURN_STAGE_LABELS, type ReturnStage } from "@/lib/clients/insights";
import { perfilDoTenant } from "@/lib/marca-atual";
import { fraseDeRetorno } from "@/lib/marca";
import { lerFicha, resumoFicha } from "@/lib/clients/ficha";
import { progresso, STATUS_PACOTE } from "@/lib/packages/rules";
import { regraFaltaDe } from "@/lib/packages/service";
import { describeVisit } from "@/lib/appointments/summary";
import { ClientForm } from "./client-form";

export default async function ClientDetailPage({ params }: PageProps<"/app/clientes/[id]">) {
  const { id } = await params;
  const { tenant } = await requireAuth();
  const client = await db.client.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      appointments: { orderBy: { startsAt: "desc" }, take: 50, include: { items: { orderBy: { sortOrder: "asc" }, select: { serviceName: true } } } },
      packages: { orderBy: { createdAt: "desc" }, include: { sessions: { select: { status: true } } } },
    },
  });
  if (!client) notFound();
  const regra = regraFaltaDe(tenant);
  const pacotes = client.packages.map((pk) => ({ ...pk, p: progresso(pk, pk.sessions, regra) })).filter((x) => x.status === "ACTIVE" || x.p.agendadas > 0).slice(0, 5);

  const now = new Date();
  const completed = client.appointments.filter((a) => a.status === "COMPLETED");
  const completedDates = completed.map((a) => a.startsAt);
  const spent = completed.reduce((s, a) => s + a.priceCents, 0);
  const noShows = client.appointments.filter((a) => a.status === "NO_SHOW").length;
  const lastVisit = completedDates[0] ?? null; // lista já vem em ordem decrescente
  const observed = averageIntervalDays(completedDates);
  const hasUpcoming = client.appointments.some((a) => a.startsAt > now && ACTIVE_STATUSES.includes(a.status));
  const ret = predictReturn({ completedDates, declaredIntervalDays: client.maintenanceIntervalDays, hasUpcoming, now });
  const { segmentos, ficha: campos } = perfilDoTenant(tenant);
  const grupos = Object.fromEntries(segmentos.map((s) => [s.slug, s.nome]));
  const recurring = isRecurring(completedDates, now);

  // Serviços realizados (contagem por item, não por visita)
  const byService = new Map<string, number>();
  for (const a of completed) for (const it of a.items) byService.set(it.serviceName, (byService.get(it.serviceName) ?? 0) + 1);
  const topServices = [...byService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <div className="mb-4"><Link href="/app/clientes" className="text-sm text-zinc-500 hover:underline">‹ Clientes</Link></div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <ClientForm
            id={client.id}
            initial={{
              name: client.name, phone: formatPhone(client.phone), email: client.email ?? "", notes: client.notes ?? "",
              ficha: lerFicha(client.ficha, campos), allergies: client.allergies ?? "",
              maintenanceIntervalDays: client.maintenanceIntervalDays,
            }}
            campos={campos}
            grupos={grupos}
          />
          <Link href={`/app/agenda/novo?cliente=${encodeURIComponent(client.phone)}`} className="btn-primary w-full">Agendar para esta cliente</Link>
          <a href={whatsappLink(client.phone)} target="_blank" rel="noreferrer" className="btn-secondary w-full">💬 Chamar no WhatsApp</a>
        </div>

        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={String(completed.length)} label="atendimentos" />
            <Stat value={formatCents(spent)} label="investidos" />
            <Stat value={lastVisit ? fmtDate(lastVisit, tenant.timezone) : "—"} label="última visita" />
            <Stat value={observed ? `~${observed} dias` : "—"} label="frequência" hint={recurring ? "cliente recorrente ✨" : undefined} />
          </section>

          {(ret.stage !== "unknown" || ret.dueAt) && (
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${ret.stage === "due" || ret.stage === "overdue" ? "border-amber-300 bg-amber-50 text-amber-900" : ret.stage === "inactive" ? "border-zinc-300 bg-zinc-50 text-zinc-700" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
              <span>
                {ret.stage === "inactive" ? <>💤 Sem atendimento há <strong>{ret.daysSinceLast} dias</strong> — cliente inativa.</>
                  : ret.stage === "unknown" && ret.dueAt ? <>✅ Retorno previsto para <strong>{fmtDate(ret.dueAt, tenant.timezone)}</strong> (em {ret.daysUntilDue} dia(s)).</>
                  : <>✨ <strong>{RETURN_STAGE_LABELS[ret.stage as Exclude<ReturnStage, "unknown">]}</strong>{ret.dueAt ? <> — retorno previsto para <strong>{fmtDate(ret.dueAt, tenant.timezone)}</strong></> : null}{ret.source === "learned" && ret.intervalDays ? <> · ciclo aprendido ~{ret.intervalDays} d</> : null}.</>}
              </span>
              {ret.stage !== "unknown" && <a href={whatsappLink(client.phone, returnMessage(client.name, ret.stage, fraseDeRetorno(segmentos)))} target="_blank" rel="noreferrer" className="btn-ghost shrink-0 px-2 py-1 text-xs">💬 Chamar no WhatsApp</a>}
            </div>
          )}
          {noShows > 0 && <p className="text-xs text-rose-600">⚠️ {noShows} falta(s) registrada(s).</p>}

          {pacotes.length > 0 && (
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Pacotes</h2>
                <Link href={`/app/pacotes/novo?cliente=${client.id}`} className="text-xs text-zinc-500 hover:underline">+ vender pacote</Link>
              </div>
              <ul className="mt-2 space-y-2 text-sm">
                {pacotes.map((pk) => (
                  <li key={pk.id} className="flex items-center justify-between gap-2">
                    <Link href={`/app/pacotes/${pk.id}`} className="min-w-0 truncate hover:underline">{pk.name}</Link>
                    <span className="shrink-0 text-xs text-zinc-500">{pk.p.restantes}/{pk.p.total} restantes{pk.p.agendadas ? ` · ${pk.p.agendadas} agendada(s)` : ""}{pk.status !== "ACTIVE" ? ` · ${STATUS_PACOTE[pk.status]}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topServices.length > 0 && (
            <section className="card p-5">
              <h2 className="font-medium">Procedimentos realizados</h2>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {topServices.map(([name, n]) => (
                  <li key={name} className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">{name} <span className="text-brand-500">×{n}</span></li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-medium">Histórico de agendamentos</h2>
            {client.appointments.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Nenhum agendamento.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                {client.appointments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/app/agendamentos/${a.id}`} className="hover:underline">
                      <span className="font-medium">{fmtDateTime(a.startsAt, tenant.timezone)}</span> · {describeVisit(a.items)} · {formatCents(a.priceCents)}
                      {a.registro ? <span className="block text-xs text-zinc-500">✍️ {resumoFicha(campos, lerFicha(a.registro, campos)) || "registro sem campos"}</span> : null}
                    </Link>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
      {hint && <p className="mt-1 text-xs font-medium text-brand-600">{hint}</p>}
    </div>
  );
}

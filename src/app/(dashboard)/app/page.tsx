import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { addDaysToKey, todayKey, zonedDateTimeToUtc, fmtDateKeyLong, fmtDateShort, fmtTime, minutesToHHMM } from "@/lib/dates";
import { StatusBadge } from "@/components/ui/status-badge";
import { ACTIVE_STATUSES } from "@/lib/appointments/status";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { formatCents } from "@/lib/money";
import { AppointmentCard } from "@/components/dashboard/appointment-card";
import { Alert } from "@/components/ui/alert";
import { getAvailableSlots } from "@/lib/scheduling/service";
import { isRecurring, predictReturn, returnMessage, RETURN_STAGE_LABELS, RETURN_STAGE_ORDER, type ReturnStage } from "@/lib/clients/insights";
import { whatsappLink } from "@/lib/phone";
import { perfilDoTenant } from "@/lib/marca-atual";
import { escolheuSegmentos, fraseDeRetorno } from "@/lib/marca";
import { cardInclude, withProfessionals } from "@/lib/appointments/queries";
import { describeProfessionals } from "@/lib/appointments/summary";

export default async function DashboardHome({ searchParams }: PageProps<"/app">) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const { tenant } = ctx;
  // STAFF vê só a própria agenda; OWNER vê toda a equipe.
  const proIds = ctx.professionals.map((p) => p.id);
  const scope = { tenantId: tenant.id, ...withProfessionals(proIds) };
  const showPro = ctx.professionals.length > 1;
  const tz = tenant.timezone;
  const today = todayKey(tz);
  const now = new Date();
  const dayStart = zonedDateTimeToUtc(today, 0, tz);
  const dayEnd = zonedDateTimeToUtc(addDaysToKey(today, 1), 0, tz);
  const monthStart = zonedDateTimeToUtc(today.slice(0, 8) + "01", 0, tz);
  const in30 = new Date(now.getTime() + 30 * 86_400_000);
  const since365 = new Date(now.getTime() - 365 * 86_400_000);
  const { marca, segmentos } = perfilDoTenant(tenant);

  const [todayList, upcoming, pendingCount, monthStats, forecast, topServices, clientsCount, servicesCount, cancelledMonth, recentCompleted, freeSlots] = await Promise.all([
    db.appointment.findMany({
      where: { ...scope, startsAt: { gte: dayStart, lt: dayEnd } },
      include: cardInclude,
      orderBy: { startsAt: "asc" },
    }),
    db.appointment.findMany({
      where: { ...scope, startsAt: { gte: dayEnd, lte: in30 }, status: { in: ACTIVE_STATUSES } },
      include: cardInclude, orderBy: { startsAt: "asc" }, take: 8,
    }),
    db.appointment.count({ where: { ...scope, status: { in: ["PENDING", "AWAITING_PAYMENT", "AWAITING_CONFIRMATION", "RESCHEDULE_REQUESTED"] }, startsAt: { gte: now } } }),
    db.appointment.aggregate({ where: { ...scope, status: "COMPLETED", startsAt: { gte: monthStart } }, _count: true, _sum: { priceCents: true } }),
    // Faturamento estimado: concluídos + confirmados do mês
    db.appointment.aggregate({ where: { ...scope, startsAt: { gte: monthStart }, status: { in: ["CONFIRMED", "COMPLETED"] } }, _sum: { priceCents: true } }),
    db.appointment.groupBy({
      by: ["serviceName"],
      where: { ...scope, startsAt: { gte: monthStart }, status: { notIn: ["CANCELLED_BY_CLIENT", "CANCELLED_BY_PROFESSIONAL"] } },
      _count: true, orderBy: { _count: { serviceName: "desc" } }, take: 5,
    }),
    db.client.count({ where: { tenantId: tenant.id } }),
    db.service.count({ where: { tenantId: tenant.id, active: true, deletedAt: null, isAddOn: false } }),
    db.appointment.count({ where: { ...scope, startsAt: { gte: monthStart }, status: { in: ["CANCELLED_BY_CLIENT", "CANCELLED_BY_PROFESSIONAL"] } } }),
    // Base para "clientes recorrentes" e "retornos": concluídos do último ano (inativa = 90+ dias sem vir)
    db.appointment.findMany({
      where: { ...scope, status: "COMPLETED", startsAt: { gte: since365 } },
      select: { clientId: true, startsAt: true, client: { select: { id: true, name: true, phone: true, maintenanceIntervalDays: true } } },
      orderBy: { startsAt: "desc" },
    }),
    // Horários livres de hoje: menor duração entre os procedimentos ativos (o que ainda "cabe" na agenda)
    (async () => {
      const shortest = await db.service.findFirst({ where: { tenantId: tenant.id, active: true, deletedAt: null, isAddOn: false }, orderBy: { durationMinutes: "asc" }, select: { durationMinutes: true } });
      if (!shortest) return [];
      const perPro = await Promise.all(proIds.map((professionalId) => getAvailableSlots({ tenant, professionalId, dateKey: today, durationMinutes: shortest.durationMinutes, now })));
      return [...new Set(perPro.flat().map((s) => s.minutes))].sort((a, b) => a - b);
    })(),
  ]);

  // Clientes recorrentes e retorno inteligente (regras em src/lib/clients/insights.ts; vocabulário do segmento)
  const byClient = new Map<string, { client: (typeof recentCompleted)[number]["client"]; dates: Date[] }>();
  for (const a of recentCompleted) {
    const e = byClient.get(a.clientId) ?? { client: a.client, dates: [] };
    e.dates.push(a.startsAt);
    byClient.set(a.clientId, e);
  }
  const recurringCount = [...byClient.values()].filter((e) => isRecurring(e.dates, now)).length;
  const upcomingClientIds = new Set((await db.appointment.findMany({ where: { ...scope, startsAt: { gte: now }, status: { in: ACTIVE_STATUSES } }, select: { clientId: true } })).map((a) => a.clientId));
  const returns = [...byClient.values()]
    .map((e) => ({ client: e.client, p: predictReturn({ completedDates: e.dates, declaredIntervalDays: e.client.maintenanceIntervalDays, hasUpcoming: upcomingClientIds.has(e.client.id), now }) }))
    .filter((x) => x.p.stage !== "unknown")
    .sort((a, b) => RETURN_STAGE_ORDER[a.p.stage] - RETURN_STAGE_ORDER[b.p.stage] || (a.p.daysUntilDue ?? 0) - (b.p.daysUntilDue ?? 0))
    .slice(0, 6);
  const convite = fraseDeRetorno(segmentos);
  const pedirSegmentos = ctx.canManage && !escolheuSegmentos(marca, tenant);

  const activeToday = todayList.filter((a) => ACTIVE_STATUSES.includes(a.status));
  const next = activeToday.find((a) => a.endsAt > now) ?? upcoming[0] ?? null;

  return (
    <>
      {pedirSegmentos && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-sm">
          <span>✨ <strong>O que você faz?</strong> Marque os segmentos do seu negócio (cabelo, unhas, cílios…) para o {marca.nome} montar categorias, ficha e mensagens do seu jeito.</span>
          <Link href="/app/configuracoes/segmentos" className="btn-primary shrink-0 px-3 py-1.5 text-xs">Escolher segmentos</Link>
        </div>
      )}
      {sp.bemvindo && (
        <div className="mb-6">
          <Alert kind="success">
            Conta criada! Próximos passos: <Link href="/app/servicos/novo" className="underline">cadastre seus procedimentos</Link>,{" "}
            <Link href="/app/configuracoes/horarios" className="underline">confira seus horários</Link>,{" "}
            <Link href="/app/portfolio/novo" className="underline">publique fotos dos seus trabalhos</Link> e divulgue seu{" "}
            <Link href="/app/configuracoes" className="underline">link de agendamento</Link>.
          </Alert>
        </div>
      )}
      {servicesCount === 0 && !sp.bemvindo && (
        <div className="mb-6">
          <Alert kind="info">Sua página pública só aceita agendamentos depois que você <Link href="/app/servicos/novo" className="underline">cadastrar um procedimento</Link>.</Alert>
        </div>
      )}

      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-sm text-zinc-500">Olá, {ctx.user.name.split(" ")[0]} 💅</p>
          <h1 className="text-2xl font-semibold tracking-tight">{fmtDateKeyLong(today)}</h1>
        </div>
        <Link href="/app/agenda/novo" className="btn-primary">+ Agendar</Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hoje" value={String(activeToday.length)} hint={`${freeSlots.length} horário(s) livre(s)`} />
        <Stat label="Pendentes" value={String(pendingCount)} hint="aguardando confirmação, pagamento ou remarcação" accent={pendingCount > 0} />
        <Stat label="Atendimentos no mês" value={String(monthStats._count)} hint={`${cancelledMonth} cancelamento(s)`} />
        <Stat label="Faturamento no mês" value={formatCents(monthStats._sum.priceCents ?? 0)} hint={`estimado: ${formatCents(forecast._sum.priceCents ?? 0)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {next && (
            <section className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Próximo atendimento</p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg font-semibold">
                  {fmtTime(next.startsAt, tz)}{next.startsAt >= dayEnd ? ` · ${fmtDateShort(next.startsAt, tz)}` : ""} — {next.client.name}
                </p>
                <Link href={`/app/agendamentos/${next.id}`} className="text-sm text-brand-700 hover:underline">Ver detalhes →</Link>
              </div>
              <p className="text-sm text-zinc-600">{next.serviceName} · {next.durationMinutes} min · {formatCents(next.priceCents)}{showPro ? ` · ${describeProfessionals(next.items)}` : ""}</p>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Agenda de hoje</h2>
              <Link href={`/app/agenda?view=day&date=${today}`} className="text-sm text-zinc-500 hover:underline">Ver agenda</Link>
            </div>
            {todayList.length === 0 ? (
              <div className="card px-6 py-8 text-center text-sm text-zinc-500">Nenhum agendamento hoje.</div>
            ) : (
              <div className="space-y-2">{todayList.map((a) => <AppointmentCard key={a.id} appointment={a} tz={tz} showProfessional={showPro} />)}</div>
            )}
            {freeSlots.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                <span className="mr-1">Livre hoje:</span>
                {freeSlots.slice(0, 12).map((m) => (
                  <Link key={m} href={`/app/agenda/novo`} className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 tabular-nums hover:border-brand-400 hover:text-brand-700">{minutesToHHMM(m)}</Link>
                ))}
                {freeSlots.length > 12 && <span>+{freeSlots.length - 12}</span>}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Próximos agendamentos</h2>
            {upcoming.length === 0 ? (
              <div className="card px-6 py-8 text-center text-sm text-zinc-500">Nada nos próximos 30 dias.</div>
            ) : (
              <div className="card divide-y divide-zinc-100">
                {upcoming.map((a) => <UpcomingRow key={a.id} a={a} tz={tz} showPro={showPro} />)}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {returns.length > 0 && (
            <section className="card border-brand-200 p-5">
              <h2 className="font-medium">Retornos ✨</h2>
              <p className="text-xs text-zinc-500">clientes chegando ao ciclo habitual e sem horário marcado — 💬 abre o WhatsApp com a mensagem sugerida</p>
              <ul className="mt-3 space-y-2 text-sm">
                {returns.map(({ client, p }) => (
                  <li key={client.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/app/clientes/${client.id}`} className="block truncate hover:underline">{client.name}</Link>
                      <span className={`text-xs ${p.stage === "approaching" ? "text-emerald-700" : p.stage === "inactive" ? "text-zinc-500" : "text-amber-700"}`}>
                        {RETURN_STAGE_LABELS[p.stage as Exclude<ReturnStage, "unknown">]}
                        {p.stage === "inactive" ? ` · há ${p.daysSinceLast} d` : p.daysUntilDue == null ? "" : p.daysUntilDue > 0 ? ` · em ${p.daysUntilDue} d` : p.daysUntilDue < 0 ? ` · há ${-p.daysUntilDue} d` : " · hoje"}
                        {p.source === "learned" && p.intervalDays ? ` · ciclo aprendido ~${p.intervalDays} d` : ""}
                      </span>
                    </div>
                    <a href={whatsappLink(client.phone, returnMessage(client.name, p.stage, convite))} target="_blank" rel="noreferrer" className="btn-ghost shrink-0 px-2 py-1 text-xs" title="Abrir WhatsApp com a mensagem sugerida">💬</a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-medium">Procedimentos mais agendados</h2>
            <p className="text-xs text-zinc-500">neste mês</p>
            {topServices.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Sem dados ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {topServices.map((s) => {
                  const max = topServices[0]._count;
                  return (
                    <li key={s.serviceName}>
                      <div className="flex justify-between"><span>{s.serviceName}</span><span className="tabular-nums text-zinc-500">{s._count}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-100"><div className="h-1.5 rounded-full bg-brand-400" style={{ width: `${(s._count / max) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-medium">Clientes</h2>
            <div className="mt-2 flex items-baseline gap-4">
              <div><p className="text-3xl font-semibold">{clientsCount}</p><p className="text-xs text-zinc-500">no total</p></div>
              <div><p className="text-3xl font-semibold text-brand-600">{recurringCount}</p><p className="text-xs text-zinc-500">recorrentes (90 dias)</p></div>
            </div>
            <Link href="/app/clientes" className="mt-2 block text-sm text-zinc-500 hover:underline">Ver clientes →</Link>
          </section>
        </aside>
      </div>
    </>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? "border-amber-300 bg-amber-50" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function UpcomingRow({ a, tz, showPro }: { a: { id: string; startsAt: Date; serviceName: string; status: AppointmentStatus; client: { name: string }; items: { professional: { name: string } }[] }; tz: string; showPro: boolean }) {
  return (
    <Link href={`/app/agendamentos/${a.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50">
      <span className="w-28 shrink-0 text-zinc-600">{fmtDateShort(a.startsAt, tz)}</span>
      <span className="w-12 shrink-0 font-medium tabular-nums">{fmtTime(a.startsAt, tz)}</span>
      <span className="min-w-0 flex-1 truncate">{a.client.name} · <span className="text-zinc-500">{a.serviceName}{showPro ? ` · ${describeProfessionals(a.items)}` : ""}</span></span>
      <StatusBadge status={a.status} />
    </Link>
  );
}

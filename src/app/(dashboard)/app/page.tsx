import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { addDaysToKey, fmtDate, fmtTime, todayKey, toDateKey, zonedDateTimeToUtc } from "@/lib/dates";
import { StatusBadge } from "@/components/ui/status-badge";
import { ACTIVE_STATUSES } from "@/lib/appointments/status";
import { formatCents } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/dashboard/avatar";
import { AreaChart, CORES_FATIAS, Donut, Ring, Sparkline } from "@/components/dashboard/charts";
import { predictReturn, returnMessage, RETURN_STAGE_LABELS, RETURN_STAGE_ORDER, type ReturnStage } from "@/lib/clients/insights";
import { whatsappLink } from "@/lib/phone";
import { perfilDoTenant } from "@/lib/marca-atual";
import { escolheuSegmentos, fraseDeRetorno } from "@/lib/marca";
import { withProfessionals } from "@/lib/appointments/queries";
import { lerFicha, resumoFicha } from "@/lib/clients/ficha";

/**
 * Painel inicial (padrão Heeca, ver docs/PADRAO-PAINEL.md): saudação + KPIs com mini-gráfico, faturamento do mês,
 * serviços por categoria, indicadores de relacionamento, agenda de hoje e WhatsApp; coluna direita com meta,
 * próximo atendimento (com a ficha), retornos e ações rápidas. STAFF vê só a própria agenda.
 */
const DIA = 86_400_000;
const saudacao = (h: number) => (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");

export default async function DashboardHome({ searchParams }: PageProps<"/app">) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const { tenant } = ctx;
  const proIds = ctx.professionals.map((p) => p.id);
  const scope = { tenantId: tenant.id, ...withProfessionals(proIds) };
  const showPro = ctx.professionals.length > 1;
  const tz = tenant.timezone;
  const now = new Date();
  const today = todayKey(tz);
  const dayStart = zonedDateTimeToUtc(today, 0, tz);
  const dayEnd = zonedDateTimeToUtc(addDaysToKey(today, 1), 0, tz);
  const monthKey = today.slice(0, 7);
  const monthStart = zonedDateTimeToUtc(`${monthKey}-01`, 0, tz);
  const prevMonthKey = toDateKey(new Date(monthStart.getTime() - DIA), tz).slice(0, 7);
  const prevMonthStart = zonedDateTimeToUtc(`${prevMonthKey}-01`, 0, tz);
  const since90 = new Date(now.getTime() - 90 * DIA), since365 = new Date(now.getTime() - 365 * DIA);
  const weekStart = new Date(now.getTime() - 7 * DIA);
  const { marca, segmentos, ficha } = perfilDoTenant(tenant);
  const horaLocal = Number(fmtDate(now, tz, "H"));

  const [todayList, ontem, mes, mesAnterior, concluidosMes, itensMes, clientesAtivas, clientesAtivasAntes, faltasMes, recentCompleted, mensagens, itensSemana, regras, servicesCount, proximo, upcomingIds] = await Promise.all([
    db.appointment.findMany({ where: { ...scope, startsAt: { gte: dayStart, lt: dayEnd } }, include: { client: { select: { id: true, name: true } }, items: { orderBy: { sortOrder: "asc" }, select: { serviceName: true, professional: { select: { name: true } } } } }, orderBy: { startsAt: "asc" } }),
    db.appointment.count({ where: { ...scope, startsAt: { gte: zonedDateTimeToUtc(addDaysToKey(today, -1), 0, tz), lt: dayStart }, status: { notIn: ["CANCELLED_BY_CLIENT", "CANCELLED_BY_PROFESSIONAL"] } } }),
    db.appointment.aggregate({ where: { ...scope, status: "COMPLETED", startsAt: { gte: monthStart } }, _count: true, _sum: { priceCents: true } }),
    db.appointment.aggregate({ where: { ...scope, status: "COMPLETED", startsAt: { gte: prevMonthStart, lt: monthStart } }, _count: true, _sum: { priceCents: true } }),
    db.appointment.findMany({ where: { ...scope, status: "COMPLETED", startsAt: { gte: monthStart } }, select: { startsAt: true, priceCents: true } }),
    db.appointmentItem.findMany({ where: { tenantId: tenant.id, professionalId: { in: proIds }, startsAt: { gte: monthStart }, appointment: { status: "COMPLETED" } }, select: { service: { select: { category: { select: { name: true } } } } } }),
    db.appointment.findMany({ where: { ...scope, status: "COMPLETED", startsAt: { gte: since90 } }, distinct: ["clientId"], select: { clientId: true } }),
    db.appointment.findMany({ where: { ...scope, status: "COMPLETED", startsAt: { gte: new Date(since90.getTime() - 90 * DIA), lt: since90 } }, distinct: ["clientId"], select: { clientId: true } }),
    db.appointment.count({ where: { ...scope, status: "NO_SHOW", startsAt: { gte: monthStart } } }),
    db.appointment.findMany({ where: { ...scope, status: "COMPLETED", startsAt: { gte: since365 } }, select: { clientId: true, startsAt: true, client: { select: { id: true, name: true, phone: true, maintenanceIntervalDays: true } } }, orderBy: { startsAt: "desc" } }),
    db.whatsappMessage.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, kind: true, direction: true, status: true, createdAt: true, client: { select: { name: true } } } }),
    db.appointmentItem.findMany({ where: { tenantId: tenant.id, professionalId: { in: proIds }, startsAt: { gte: weekStart, lt: now }, appointment: { status: { in: ["CONFIRMED", "COMPLETED"] } } }, select: { durationMinutes: true } }),
    db.availabilityRule.findMany({ where: { professionalId: { in: proIds } }, select: { startMinutes: true, endMinutes: true, breakStartMinutes: true, breakEndMinutes: true } }),
    db.service.count({ where: { tenantId: tenant.id, active: true, deletedAt: null, isAddOn: false } }),
    db.appointment.findFirst({ where: { ...scope, endsAt: { gt: now }, status: { in: ACTIVE_STATUSES } }, orderBy: { startsAt: "asc" }, include: { client: { select: { id: true, name: true, ficha: true } }, items: { orderBy: { sortOrder: "asc" }, select: { serviceName: true, professional: { select: { name: true, photoUrl: true } } } } } }),
    db.appointment.findMany({ where: { ...scope, startsAt: { gte: now }, status: { in: ACTIVE_STATUSES } }, select: { clientId: true } }),
  ]);

  // Série do mês por dia (faturamento concluído), até hoje
  const hojeDia = Number(today.slice(8, 10));
  const porDia = new Map<number, number>();
  for (const a of concluidosMes) { const d = Number(toDateKey(a.startsAt, tz).slice(8, 10)); porDia.set(d, (porDia.get(d) ?? 0) + a.priceCents); }
  const mesAbrev = fmtDate(monthStart, tz, "MMM").replace(".", "");
  const serie = Array.from({ length: hojeDia }, (_, i) => ({ rotulo: `${i + 1} ${mesAbrev}`, valor: (porDia.get(i + 1) ?? 0) / 100 }));
  const ultimos7 = (f: (k: string) => number) => { const out: number[] = []; for (let i = 6; i >= 0; i--) out.push(f(toDateKey(new Date(now.getTime() - i * DIA), tz))); return out; };
  const sparkFat = ultimos7((k) => concluidosMes.filter((a) => toDateKey(a.startsAt, tz) === k).reduce((n, a) => n + a.priceCents, 0));
  const sparkAtend = ultimos7((k) => recentCompleted.filter((a) => toDateKey(a.startsAt, tz) === k).length);

  // Rosca: itens concluídos no mês por categoria
  const porCategoria = new Map<string, number>();
  for (const it of itensMes) { const n = it.service.category?.name ?? "Sem categoria"; porCategoria.set(n, (porCategoria.get(n) ?? 0) + 1); }
  const fatias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([rotulo, valor], i) => ({ rotulo, valor, cor: CORES_FATIAS[i] }));

  // Ocupação: minutos atendidos nos últimos 7 dias ÷ minutos de grade da equipe na semana
  const gradeSemana = regras.reduce((n, r) => n + (r.endMinutes - r.startMinutes) - (r.breakStartMinutes != null && r.breakEndMinutes != null ? r.breakEndMinutes - r.breakStartMinutes : 0), 0);
  const ocupacao = gradeSemana > 0 ? Math.min(100, Math.round((itensSemana.reduce((n, i) => n + i.durationMinutes, 0) / gradeSemana) * 100)) : null;

  // Retornos inteligentes
  const byClient = new Map<string, { client: (typeof recentCompleted)[number]["client"]; dates: Date[] }>();
  for (const a of recentCompleted) { const e = byClient.get(a.clientId) ?? { client: a.client, dates: [] }; e.dates.push(a.startsAt); byClient.set(a.clientId, e); }
  const upcomingClientIds = new Set(upcomingIds.map((a) => a.clientId));
  const returns = [...byClient.values()]
    .map((e) => ({ client: e.client, p: predictReturn({ completedDates: e.dates, declaredIntervalDays: e.client.maintenanceIntervalDays, hasUpcoming: upcomingClientIds.has(e.client.id), now }) }))
    .filter((x) => x.p.stage !== "unknown")
    .sort((a, b) => RETURN_STAGE_ORDER[a.p.stage] - RETURN_STAGE_ORDER[b.p.stage] || (a.p.daysUntilDue ?? 0) - (b.p.daysUntilDue ?? 0));
  const convite = fraseDeRetorno(segmentos);
  const pedirSegmentos = ctx.canManage && !escolheuSegmentos(marca, tenant);

  const ativosHoje = todayList.filter((a) => ACTIVE_STATUSES.includes(a.status) || a.status === "COMPLETED");
  const fatMes = mes._sum.priceCents ?? 0, fatAnterior = mesAnterior._sum.priceCents ?? 0;
  const deltaFat = fatAnterior > 0 ? Math.round(((fatMes - fatAnterior) / fatAnterior) * 100) : null;
  const ticketMedio = mes._count > 0 ? Math.round(fatMes / mes._count) : 0;
  const meta = tenant.metaMensalCents;
  const retornosNoPonto = returns.filter((r) => r.p.stage === "due" || r.p.stage === "overdue").length;
  const primeiroNome = ctx.user.name.split(" ")[0];
  const proximoFicha = proximo ? resumoFicha(ficha, lerFicha(proximo.client.ficha, ficha)) : "";

  const KIND: Record<string, string> = { REQUEST_CONFIRMATION: "pedido de confirmação para", CONFIRMED: "confirmação enviada para", REMINDER: "lembrete enviado para", CANCELLED: "aviso de cancelamento para", RESCHEDULED: "remarcação avisada a", PAYMENT_REQUEST: "cobrança do sinal para" };
  const COR_KIND: Record<string, string> = { INBOUND: "bg-emerald-500", REMINDER: "bg-sky-500", PAYMENT_REQUEST: "bg-brand-600", CANCELLED: "bg-zinc-400", RESCHEDULED: "bg-amber-500" };

  return (
    <>
      {pedirSegmentos && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm">
          <span>✨ <strong>O que você faz?</strong> Marque os segmentos do seu negócio para o {marca.nome} montar categorias, ficha e mensagens do seu jeito.</span>
          <Link href="/app/configuracoes/segmentos" className="btn-primary shrink-0 px-3 py-1.5 text-xs">Escolher segmentos</Link>
        </div>
      )}
      {sp.bemvindo && (
        <div className="mb-4">
          <Alert kind="success">
            Conta criada! Próximos passos: <Link href="/app/servicos/novo" className="underline">cadastre seus serviços</Link>, <Link href="/app/configuracoes/horarios" className="underline">confira seus horários</Link> e divulgue seu <Link href="/app/configuracoes" className="underline">link de agendamento</Link>.
          </Alert>
        </div>
      )}
      {servicesCount === 0 && !sp.bemvindo && (
        <div className="mb-4"><Alert kind="info">Sua página pública só aceita agendamentos depois que você <Link href="/app/servicos/novo" className="underline">cadastrar um serviço</Link>.</Alert></div>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        {/* ─── coluna principal ─── */}
        <div className="grid min-w-0 content-start gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-[21px] font-semibold tracking-tight">{saudacao(horaLocal)}, {primeiroNome}! 👋</h1>
              <p className="mt-0.5 text-[13px] text-mut">Sua agenda, suas clientes e o mês inteiro num lugar só.</p>
            </div>
            <Link href="/app/agenda/novo" className="btn-primary shrink-0">+ Agendar</Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Atendimentos hoje" valor={String(ativosHoje.length)} delta={ativosHoje.length - ontem} deltaTxt="vs ontem" cor="var(--color-brand-600)" tile="bg-brand-50 text-brand-600" icone="cal" spark={sparkAtend} id="a" />
            <Kpi rotulo="Faturamento do mês" valor={formatCents(fatMes)} delta={deltaFat} deltaTxt="vs mês anterior" pct cor="#16a34a" tile="bg-emerald-50 text-emerald-600" icone="money" spark={sparkFat} id="b" />
            <Kpi rotulo="Clientes ativas" valor={String(clientesAtivas.length)} delta={clientesAtivas.length - clientesAtivasAntes.length} deltaTxt="vs 90 dias antes" cor="#2563eb" tile="bg-sky-50 text-sky-600" icone="users" spark={[clientesAtivasAntes.length, clientesAtivas.length]} id="c" />
            <Kpi rotulo="Ocupação da agenda" valor={ocupacao == null ? "—" : `${ocupacao}%`} deltaTxt="últimos 7 dias" cor="#d97706" tile="bg-amber-50 text-amber-600" icone="clock" spark={ocupacao == null ? [] : [ocupacao * 0.8, ocupacao * 0.9, ocupacao]} id="d" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <section className="card min-w-0 p-4">
              <div className="card-hd"><h2 className="card-title">Faturamento</h2><span className="rounded-[10px] border border-line px-2.5 py-1 text-xs font-medium capitalize text-ink-2">{fmtDate(monthStart, tz, "MMMM")}</span></div>
              {concluidosMes.length === 0 ? <p className="py-10 text-center text-sm text-mut">Ainda sem atendimentos concluídos neste mês.</p> : <AreaChart pontos={serie} formato={(v) => `R$ ${Math.round(v)}`} />}
            </section>
            <section className="card min-w-0 p-4">
              <div className="card-hd"><h2 className="card-title">Serviços por categoria</h2></div>
              {fatias.length === 0 ? <p className="py-10 text-center text-sm text-mut">Sem atendimentos concluídos no mês.</p> : <Donut fatias={fatias} totalRotulo={`${itensMes.length} atend.`} />}
            </section>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Mini rotulo="Retornos no ponto" valor={`${retornosNoPonto} cliente${retornosNoPonto === 1 ? "" : "s"}`} tile="bg-brand-50 text-brand-600" icone="refresh" />
            <Mini rotulo="Faltas no mês" valor={String(faltasMes)} tile="bg-rose-50 text-rose-600" icone="x" />
            <Mini rotulo="Ticket médio" valor={mes._count ? formatCents(ticketMedio) : "—"} tile="bg-sky-50 text-sky-600" icone="trend" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <section className="card min-w-0 p-4">
              <div className="card-hd"><h2 className="card-title">Agenda de hoje</h2><Link href={`/app/agenda?view=day&date=${today}`} className="link-mut">Ver agenda ›</Link></div>
              {todayList.length === 0 ? (
                <p className="py-8 text-center text-sm text-mut">Nenhum agendamento hoje.</p>
              ) : (
                <div className="-mx-4 overflow-x-auto px-4">
                  <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
                    <thead><tr className="text-left text-[11.5px] text-mut"><th className="pb-2 pr-2 font-medium">Cliente</th><th className="pb-2 pr-2 font-medium">Serviço</th><th className="pb-2 pr-2 font-medium">Horário</th><th className="pb-2 pr-2 font-medium">Status</th><th className="pb-2 text-right font-medium">Valor</th></tr></thead>
                    <tbody>
                      {todayList.map((a) => (
                        <tr key={a.id} className="border-t border-line">
                          <td className="py-2 pr-2"><Link href={`/app/agendamentos/${a.id}`} className="flex items-center gap-2 font-medium hover:underline"><Avatar name={a.client.name} size="sm" />{a.client.name}</Link></td>
                          <td className="py-2 pr-2 text-ink-2">{a.serviceName}{showPro ? <span className="text-mut"> · {[...new Set(a.items.map((i) => i.professional.name))].join(", ")}</span> : null}</td>
                          <td className="py-2 pr-2 tabular-nums text-ink-2">{fmtTime(a.startsAt, tz)} – {fmtTime(a.endsAt, tz)}</td>
                          <td className="py-2 pr-2"><StatusBadge status={a.status} /></td>
                          <td className="py-2 text-right font-semibold">{formatCents(a.priceCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="card min-w-0 p-4">
              <div className="card-hd"><h2 className="card-title">WhatsApp</h2><Link href="/app/configuracoes/whatsapp" className="link-mut">Configurar ›</Link></div>
              {mensagens.length === 0 ? (
                <p className="py-8 text-center text-sm text-mut">Nenhuma mensagem ainda.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {mensagens.map((m) => (
                    <li key={m.id} className="flex items-center gap-2.5 border-t border-line py-2 first:border-0 first:pt-0">
                      <span className={`size-2 shrink-0 rounded-full ${COR_KIND[m.kind] ?? "bg-brand-400"}`} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">
                        {m.direction === "INBOUND" ? <><b>{m.client?.name ?? "Cliente"}</b> respondeu</> : <>{KIND[m.kind] ?? "mensagem para"} <b>{m.client?.name ?? "cliente"}</b>{m.status === "FAILED" ? <span className="text-rose-600"> · falhou</span> : null}</>}
                      </span>
                      <span className="shrink-0 text-[11px] text-mut-2">{fmtDate(m.createdAt, tz, "d/M HH:mm")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* ─── coluna direita ─── */}
        <aside className="grid min-w-0 content-start gap-3">
          <section className="card min-w-0 p-4 text-center">
            <div className="card-hd text-left"><h2 className="card-title">Meta do mês</h2>{ctx.canManage && <Link href="/app/configuracoes" className="link-mut">{meta ? "editar" : "definir"}</Link>}</div>
            {meta ? (
              <>
                <div className="my-1 grid place-items-center"><Ring pct={(fatMes / meta) * 100} /></div>
                <b className="block text-[13px]">{formatCents(fatMes)} de {formatCents(meta)}</b>
                <p className="mt-0.5 text-xs text-mut">{fatMes >= meta ? "Meta batida. Parabéns! 🎉" : fatMes / meta >= 0.7 ? "Você está indo muito bem. Continue assim!" : "Vamos lá — o mês ainda não acabou."}</p>
              </>
            ) : (
              <p className="py-4 text-sm text-mut">Defina uma meta de faturamento em Configurações e acompanhe aqui.</p>
            )}
          </section>

          <section className="card min-w-0 p-4">
            <div className="card-hd"><h2 className="card-title">Próximo atendimento</h2>{proximo && <Link href={`/app/agendamentos/${proximo.id}`} className="link-mut">abrir ›</Link>}</div>
            {proximo ? (
              <>
                <span className="tag-acc tabular-nums">{proximo.startsAt >= dayEnd ? `${fmtDate(proximo.startsAt, tz, "EEE d/M")} · ` : ""}{fmtTime(proximo.startsAt, tz)} – {fmtTime(proximo.endsAt, tz)}</span>
                <b className="mt-2 block text-[14px]"><Link href={`/app/clientes/${proximo.client.id}`} className="hover:underline">{proximo.client.name}</Link></b>
                <p className="text-xs text-mut">{proximo.serviceName} · {proximo.durationMinutes} min · {formatCents(proximo.priceCents)}</p>
                {proximoFicha && <p className="mt-1.5 text-[11.5px] text-mut">Ficha: {proximoFicha}</p>}
                <div className="mt-2.5 flex">
                  {[...new Map(proximo.items.map((i) => [i.professional.name, i.professional])).values()].map((p) => <Avatar key={p.name} name={p.name} photoUrl={p.photoUrl} size="sm" className="-ml-1.5 border-2 border-white first:ml-0" />)}
                </div>
              </>
            ) : (
              <p className="py-3 text-sm text-mut">Nada marcado por enquanto.</p>
            )}
          </section>

          <section className="card min-w-0 p-4">
            <div className="card-hd"><h2 className="card-title">Retornos ✨</h2><Link href="/app/clientes" className="link-mut">Ver ›</Link></div>
            {returns.length === 0 ? (
              <p className="py-3 text-sm text-mut">Nenhuma cliente no ponto de voltar.</p>
            ) : (
              <ul className="m-0 list-none p-0 text-[12.5px]">
                {returns.slice(0, 5).map(({ client, p }) => (
                  <li key={client.id} className="flex items-center gap-2 py-1">
                    <Avatar name={client.name} size="sm" />
                    <Link href={`/app/clientes/${client.id}`} className="min-w-0 flex-1 truncate hover:underline">{client.name}</Link>
                    <span className={`shrink-0 text-[11px] font-semibold ${p.stage === "approaching" ? "text-emerald-600" : p.stage === "inactive" ? "text-mut" : "text-amber-600"}`}>
                      {p.stage === "approaching" && p.daysUntilDue != null ? `em ${p.daysUntilDue} d` : RETURN_STAGE_LABELS[p.stage as Exclude<ReturnStage, "unknown">]}
                    </span>
                    <a href={whatsappLink(client.phone, returnMessage(client.name, p.stage, convite))} target="_blank" rel="noreferrer" className="shrink-0 text-[13px]" title="WhatsApp com a mensagem sugerida">💬</a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card min-w-0 p-4">
            <div className="card-hd"><h2 className="card-title">Ações rápidas</h2></div>
            <div className="grid grid-cols-2 gap-2">
              <Acao href="/app/agenda/novo" rotulo="Novo agendamento" tile="bg-brand-50 text-brand-600" icone="plus" />
              <Acao href="/app/clientes" rotulo="Clientes" tile="bg-emerald-50 text-emerald-600" icone="user" />
              <Acao href="/app/agenda" rotulo="Agenda" tile="bg-sky-50 text-sky-600" icone="cal" />
              <Acao href={`/agendar/${tenant.slug}`} rotulo="Página pública" tile="bg-amber-50 text-amber-600" icone="globe" externo />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

const ICONES: Record<string, React.ReactNode> = {
  cal: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" /></>,
  money: <><rect x="2" y="6" width="20" height="13" rx="3" /><circle cx="12" cy="12.5" r="3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx="17" cy="9" r="3" /><path d="M22 19c0-2.6-2-4.6-4.6-4.9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></>,
  x: <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></>,
  trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
};
const Icone = ({ nome, className = "size-[18px]" }: { nome: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONES[nome]}</svg>
);

function Kpi({ rotulo, valor, delta, deltaTxt, pct, cor, tile, icone, spark, id }: { rotulo: string; valor: string; delta?: number | null; deltaTxt: string; pct?: boolean; cor: string; tile: string; icone: string; spark: number[]; id: string }) {
  return (
    <div className="card grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 overflow-hidden p-4">
      <div className="min-w-0">
        <div className="text-xs font-medium text-mut">{rotulo}</div>
        <div className="my-0.5 text-[22px] font-semibold tracking-tight">{valor}</div>
        <div className="text-[11.5px] font-semibold">
          {delta == null ? <span className="font-medium text-mut-2">{deltaTxt}</span> : (
            <><span className={delta >= 0 ? "text-emerald-600" : "text-rose-600"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}{pct ? "%" : ""}</span><span className="ml-1 font-medium text-mut-2">{deltaTxt}</span></>
          )}
        </div>
      </div>
      <div className={`tile ${tile}`}><Icone nome={icone} /></div>
      <div className="col-span-2">{spark.length > 1 ? <Sparkline values={spark} color={cor} id={id} /> : <div className="h-[34px]" />}</div>
    </div>
  );
}

function Mini({ rotulo, valor, tile, icone }: { rotulo: string; valor: string; tile: string; icone: string }) {
  return (
    <div className="card flex min-w-0 items-center gap-3 p-4">
      <div className={`tile ${tile}`}><Icone nome={icone} /></div>
      <div className="min-w-0"><div className="truncate text-xs text-mut">{rotulo}</div><div className="text-[18px] font-semibold tracking-tight">{valor}</div></div>
    </div>
  );
}

function Acao({ href, rotulo, tile, icone, externo }: { href: string; rotulo: string; tile: string; icone: string; externo?: boolean }) {
  const cls = "grid gap-1.5 rounded-[10px] border border-line p-2.5 text-[11.5px] font-medium text-ink-2 hover:border-brand-300 hover:bg-brand-50/40";
  const inner = <><span className={`tile size-7 rounded-lg ${tile}`}><Icone nome={icone} className="size-[15px]" /></span>{rotulo}</>;
  return externo ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
}

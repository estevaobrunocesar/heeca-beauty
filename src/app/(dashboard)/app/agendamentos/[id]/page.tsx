import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeProfessionals, requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtTime, todayKey, toDateKey, toMinutesOfDay } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { STATUS_LABELS, isActive } from "@/lib/appointments/status";
import { PAYMENT_LABELS } from "@/lib/payments/labels";
import { StatusBadge } from "@/components/ui/status-badge";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DetailTools } from "./detail-tools";
import { Avatar } from "@/components/dashboard/avatar";
import { RegistroForm } from "./registro-form";
import { perfilDoTenant } from "@/lib/marca-atual";
import { lerFicha, resumoFicha } from "@/lib/clients/ficha";
import { moduloClinicoAtivo } from "@/lib/treatments/rules";
import { visitIsParallel } from "@/lib/scheduling/availability";
import { AddServiceCard } from "./add-service";
import { ChangeProfessional } from "./change-professional";
import { SessionEvolution } from "../../pacotes/[id]/clinical-tools";

export default async function AppointmentDetailPage({ params }: PageProps<"/app/agendamentos/[id]">) {
  const { id } = await params;
  const ctx = await requireAuth();
  const { tenant } = ctx;
  const tz = tenant.timezone;

  const a = await db.appointment.findFirst({
    where: { id, tenantId: tenant.id, items: { some: { professionalId: { in: ctx.professionals.map((p) => p.id) } } } },
    include: {
      items: { orderBy: { sortOrder: "asc" }, include: { professional: { select: { id: true, name: true, photoUrl: true } }, room: { select: { name: true } }, addOns: true, packageSession: { select: { id: true, status: true, productsUsed: true, evolution: true, clientPackage: { select: { id: true, name: true } } } } } },
      events: { orderBy: { createdAt: "asc" } },
      charges: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "desc" } },
      payment: true,
      client: { include: { _count: { select: { appointments: true } } } },
    },
  });
  if (!a) notFound();
  // Acrescentar serviço: só enquanto o agendamento está ativo. A equipe vem do mesmo escopo do agendamento manual.
  const podeAcrescentar = isActive(a.status);
  const [servicosAtivos, equipe] = podeAcrescentar
    ? await Promise.all([
        db.service.findMany({ where: { tenantId: tenant.id, active: true, deletedAt: null }, orderBy: { sortOrder: "asc" }, include: { professionals: { select: { professionalId: true } } } }),
        Promise.resolve(activeProfessionals(ctx)),
      ])
    : [[], []];
  // Trocar o profissional de um serviço: antes de concluir (a comissão é apurada ao concluir) e só para quem vê a equipe.
  const podeTrocar = podeAcrescentar && ctx.seesTeam;
  const opcoesDoServico = (serviceId: string, atual: string) => {
    const doServico = servicosAtivos.find((x) => x.id === serviceId);
    return doServico ? equipe.filter((p) => p.id !== atual && doServico.professionals.some((ps) => ps.professionalId === p.id)).map((p) => ({ id: p.id, name: p.name })) : [];
  };
  const agoraMin = toMinutesOfDay(new Date(), tz);
  const inicioVisita = toMinutesOfDay(a.startsAt, tz);
  const arredonda5 = (m: number) => Math.min(1435, Math.ceil(m / 5) * 5);
  const mesmoDia = toDateKey(a.startsAt, tz) === todayKey(tz);
  const startNow = arredonda5(mesmoDia ? Math.max(inicioVisita, agoraMin) : inicioVisita);
  const startAfter = arredonda5(toMinutesOfDay(a.endsAt, tz));
  const totalAdicionais = a.charges.reduce((n, c) => n + c.amountCents, 0);
  const { segmentos, ficha: campos } = perfilDoTenant(tenant);
  const grupos = Object.fromEntries(segmentos.map((s) => [s.slug, s.nome]));
  const fichaAtual = lerFicha(a.client.ficha, campos);
  const ficha = resumoFicha(campos, fichaAtual);

  return (
    <>
      <div className="mb-4">
        <Link href={`/app/agenda?view=day&date=${toDateKey(a.startsAt, tz)}`} className="text-sm text-zinc-500 hover:underline">‹ Voltar para a agenda</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">{a.serviceName}</h1>
                <p className="mt-1 text-zinc-600">{fmtDateTime(a.startsAt, tz)} → {fmtTime(a.endsAt, tz)} · {a.durationMinutes} min · {formatCents(a.priceCents)}{visitIsParallel(a.items) && <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">serviços ao mesmo tempo</span>}</p>
                {/* Itens da visita: um por serviço, cada um com profissional e horário próprios (SPEC §11) */}
                <ul className="mt-3 space-y-1.5 text-sm">
                  {a.items.map((it) => (
                    <li key={it.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="w-24 shrink-0 tabular-nums text-zinc-500">{fmtTime(it.startsAt, tz)}–{fmtTime(it.endsAt, tz)}</span>
                      <span className="font-medium text-zinc-800">{it.serviceName}</span>
                      {it.addOns.map((x) => (
                        <span key={x.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-800">+ {x.name} <span className="text-brand-500">({formatCents(x.priceCents)}{x.durationMinutes ? ` · ${x.durationMinutes} min` : ""})</span></span>
                      ))}
                      <span className="text-zinc-500">· {formatCents(it.priceCents)}</span>
                      {it.room && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">🚪 {it.room.name}</span>}
                      {it.packageSession && <Link href={`/app/pacotes/${it.packageSession.clientPackage.id}`} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800 hover:underline">🎫 {it.packageSession.clientPackage.name}</Link>}
                      {(ctx.professionals.length > 1 || a.items.length > 1) && (
                        <span className="flex items-center gap-1 text-zinc-600"><Avatar name={it.professional.name} photoUrl={it.professional.photoUrl} size="sm" /> {it.professional.name}</span>
                      )}
                      {podeTrocar && <ChangeProfessional appointmentId={a.id} itemId={it.id} options={opcoesDoServico(it.serviceId, it.professionalId)} />}
                      {/* Evolução clínica da sessão (módulo Estética): gestão ou o profissional que atendeu; recepção não vê. */}
                      {it.packageSession?.status === "DONE" && ctx.role !== "RECEPTION" && moduloClinicoAtivo(tenant.segmentos) && (ctx.canManage || ctx.professionals.some((p) => p.id === it.professional.id)) && (
                        <div className="basis-full pl-[6.5rem]"><SessionEvolution sessionId={it.packageSession.id} productsUsed={it.packageSession.productsUsed} evolution={it.packageSession.evolution} /></div>
                      )}
                    </li>
                  ))}
                </ul>
                {a.charges.length > 0 && (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm">
                    <p className="font-medium text-amber-900">Valores adicionais</p>
                    <ul className="mt-1 space-y-0.5 text-amber-900">
                      {a.charges.map((c) => <li key={c.id} className="flex justify-between gap-3"><span>{c.description}</span><span className="tabular-nums">{formatCents(c.amountCents)}</span></li>)}
                    </ul>
                    <p className="mt-1 flex justify-between border-t border-amber-200 pt-1 font-medium text-amber-950"><span>Total com adicionais</span><span className="tabular-nums">{formatCents(a.priceCents + totalAdicionais)}</span></p>
                  </div>
                )}
              </div>
              <StatusBadge status={a.status} className="text-sm" />
            </div>
            {a.status === "RESCHEDULE_REQUESTED" && (
              <p className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
                🔁 A cliente pediu outro horário. Combine pelo WhatsApp e use <strong>Reagendar</strong> abaixo — o horário atual continua reservado até você remarcar ou cancelar.
              </p>
            )}
            {a.notes && <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700"><span className="font-medium">Observação da cliente:</span> {a.notes}</p>}
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <QuickActions id={a.id} status={a.status} priceCents={a.priceCents} full />
            </div>
          </section>

          {podeAcrescentar && equipe.length > 0 && (
            <AddServiceCard
              appointmentId={a.id}
              professionals={equipe.map((p) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl }))}
              services={servicosAtivos.filter((x) => !x.isAddOn).map((x) => ({ id: x.id, name: x.name, durationMinutes: x.durationMinutes, priceCents: x.priceCents, professionalIds: x.professionals.map((p) => p.professionalId) }))}
              addOns={servicosAtivos.filter((x) => x.isAddOn).map((x) => ({ id: x.id, name: x.name, durationMinutes: x.durationMinutes, priceCents: x.priceCents }))}
              startNow={startNow}
              startAfter={startAfter}
            />
          )}

          <DetailTools
            id={a.id}
            slug={tenant.slug}
            todayKey={todayKey(tz)}
            maxAdvanceDays={tenant.maxAdvanceDays}
            internalNotes={a.internalNotes ?? ""}
            canReschedule={isActive(a.status)}
            canResend={isActive(a.status) && !!a.client.phone}
          />

          {campos.length > 0 && <RegistroForm id={a.id} campos={campos} grupos={grupos} registro={lerFicha(a.registro, campos)} fichaAtual={fichaAtual} />}

          <section className="card p-5">
            <h2 className="font-medium">Histórico</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {a.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-36 shrink-0 text-xs text-zinc-400">{fmtDateTime(e.createdAt, tz)}</span>
                  <span className="text-zinc-700">
                    {e.type === "CREATED" && `Criado (${e.toStatus ? STATUS_LABELS[e.toStatus] : ""})`}
                    {e.type === "STATUS_CHANGED" && `${e.fromStatus ? STATUS_LABELS[e.fromStatus] : "?"} → ${e.toStatus ? STATUS_LABELS[e.toStatus] : "?"}`}
                    {e.type === "RESCHEDULED" && "Reagendado"}
                    {e.type === "PROFESSIONAL_CHANGED" && `Profissional trocado em ${(e.data as { serviceName?: string } | null)?.serviceName ?? "serviço"}: ${(e.data as { fromName?: string | null } | null)?.fromName ?? "?"} → ${(e.data as { toName?: string } | null)?.toName ?? "?"}`}
                    {e.type === "ITEMS_ADDED" && `Serviço acrescentado: ${(e.data as { serviceName?: string } | null)?.serviceName ?? ""}`}
                    {e.type === "CHARGES_ADDED" && `Valores adicionais lançados: ${formatCents((e.data as { totalCents?: number } | null)?.totalCents ?? 0)}`}
                    <span className="ml-1 text-xs text-zinc-400">· {e.actor === "CLIENT" ? "cliente" : e.actor === "PROFESSIONAL" ? "você" : "sistema"}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="font-medium">Cliente</h2>
            <p className="mt-2 text-lg">{a.client.name}</p>
            {a.client.phone ? <a href={whatsappLink(a.client.phone)} target="_blank" rel="noreferrer" className="text-sm text-emerald-700 hover:underline">{formatPhone(a.client.phone)}</a> : <p className="text-sm text-zinc-400">Sem telefone</p>}
            {a.client.email && <p className="text-sm text-zinc-500">{a.client.email}</p>}
            <p className="mt-2 text-xs text-zinc-500">{a.client._count.appointments} agendamento(s) no total</p>
            {(ficha || a.client.allergies || a.client.notes) && (
              <div className="mt-3 space-y-1 rounded-lg bg-brand-50/60 px-3 py-2 text-xs text-zinc-700">
                {ficha && <p>✨ {ficha}</p>}
                {a.client.allergies && <p className="text-rose-700">⚠️ {a.client.allergies}</p>}
                {a.client.notes && <p className="line-clamp-3 text-zinc-600">{a.client.notes}</p>}
              </div>
            )}
            <Link href={`/app/clientes/${a.client.id}`} className="btn-secondary mt-3 w-full">Ver ficha da cliente</Link>
          </section>

          {a.payment && (
            <section className="card p-5">
              <h2 className="font-medium">Sinal (Pix)</h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCents(a.payment.amountCents)}</p>
              <p className="text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs ${a.payment.status === "PAID" ? "bg-emerald-100 text-emerald-800" : a.payment.status === "REFUNDED" ? "bg-sky-100 text-sky-800" : a.payment.status === "PENDING" ? "bg-violet-100 text-violet-800" : "bg-zinc-100 text-zinc-600"}`}>
                  {PAYMENT_LABELS[a.payment.status]}
                </span>
                {a.payment.paidAt && <span className="ml-2 text-xs text-zinc-500">pago em {fmtDateTime(a.payment.paidAt, tz)}</span>}
                {a.payment.refundedAt && <span className="ml-2 text-xs text-zinc-500">estornado em {fmtDateTime(a.payment.refundedAt, tz)}</span>}
              </p>
              {a.payment.status === "PENDING" && <p className="mt-2 text-xs text-zinc-500">Prazo: {fmtDateTime(a.payment.expiresAt, tz)}. Se a cliente pagou em dinheiro, use &ldquo;Confirmar&rdquo; acima.</p>}
              {a.payment.error && <p className="mt-2 text-xs text-rose-600">{a.payment.error}</p>}
              <p className="mt-2 text-xs text-zinc-400">{a.payment.provider} · {a.payment.providerPaymentId}</p>
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-medium">Mensagens WhatsApp</h2>
            {a.messages.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Nenhuma mensagem.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-xs">
                {a.messages.map((m) => (
                  <li key={m.id} className="rounded-lg bg-zinc-50 p-2">
                    <div className="flex justify-between text-zinc-500">
                      <span>{m.kind}</span>
                      <span className={m.status === "FAILED" ? "text-rose-600" : ""}>{m.status}</span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-zinc-700">{m.body}</p>
                    <p className="mt-1 text-zinc-400">{fmtDateTime(m.createdAt, tz)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

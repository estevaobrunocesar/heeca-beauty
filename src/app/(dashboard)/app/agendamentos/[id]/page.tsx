import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime, fmtTime, todayKey, toDateKey } from "@/lib/dates";
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

export default async function AppointmentDetailPage({ params }: PageProps<"/app/agendamentos/[id]">) {
  const { id } = await params;
  const ctx = await requireAuth();
  const { tenant } = ctx;
  const tz = tenant.timezone;

  const a = await db.appointment.findFirst({
    where: { id, tenantId: tenant.id, items: { some: { professionalId: { in: ctx.professionals.map((p) => p.id) } } } },
    include: {
      items: { orderBy: { sortOrder: "asc" }, include: { professional: { select: { id: true, name: true, photoUrl: true } }, addOns: true } },
      events: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "desc" } },
      payment: true,
      client: { include: { _count: { select: { appointments: true } } } },
    },
  });
  if (!a) notFound();
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
                <p className="mt-1 text-zinc-600">{fmtDateTime(a.startsAt, tz)} → {fmtTime(a.endsAt, tz)} · {a.durationMinutes} min · {formatCents(a.priceCents)}</p>
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
                      {(ctx.professionals.length > 1 || a.items.length > 1) && (
                        <span className="flex items-center gap-1 text-zinc-600"><Avatar name={it.professional.name} photoUrl={it.professional.photoUrl} size="sm" /> {it.professional.name}</span>
                      )}
                    </li>
                  ))}
                </ul>
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
              <QuickActions id={a.id} status={a.status} full />
            </div>
          </section>

          <DetailTools
            id={a.id}
            slug={tenant.slug}
            todayKey={todayKey(tz)}
            maxAdvanceDays={tenant.maxAdvanceDays}
            internalNotes={a.internalNotes ?? ""}
            canReschedule={isActive(a.status)}
            canResend={isActive(a.status)}
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
            <a href={whatsappLink(a.client.phone)} target="_blank" rel="noreferrer" className="text-sm text-emerald-700 hover:underline">{formatPhone(a.client.phone)}</a>
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

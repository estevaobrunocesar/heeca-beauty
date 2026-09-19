import type { Metadata } from "next";
import Link from "next/link";
import { findByToken } from "@/lib/appointments/service";
import { db } from "@/lib/db";
import { canClientCancel } from "@/lib/appointments/policies";
import { ACTIVE_STATUSES } from "@/lib/appointments/status";
import { fmtDate, fmtTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { policyItems } from "@/lib/policies";
import { describeBooking } from "@/lib/services/addons";
import { ConfirmButtons } from "./confirm-buttons";

export const metadata: Metadata = { title: "Confirmar agendamento" };

export default async function ConfirmPage({ params, searchParams }: PageProps<"/confirmar/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const appt = await findByToken(token);
  const [payment, addOns] = appt
    ? await Promise.all([db.payment.findUnique({ where: { appointmentId: appt.id } }), db.appointmentAddOn.findMany({ where: { appointmentId: appt.id }, select: { name: true } })])
    : [null, []];

  if (!appt) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Link inválido</h1>
        <p className="mt-2 text-sm text-zinc-600">Este link de confirmação não existe ou expirou.</p>
      </Shell>
    );
  }

  const tz = appt.tenant.timezone;
  const isActive = ACTIVE_STATUSES.includes(appt.status);
  const cancelPolicy = canClientCancel(appt.tenant, appt);
  const flash =
    sp.ok === "confirmado" ? "Horário confirmado! Estamos te esperando. 💅"
    : sp.ok === "cancelado" ? "Agendamento cancelado."
    : sp.ok === "remarcar" ? "Pedido enviado! A profissional vai entrar em contato pelo WhatsApp para combinar um novo horário."
    : null;
  const policies = policyItems(appt.tenant);

  return (
    <Shell>
      <p className="text-sm text-zinc-500">{appt.tenant.businessName}</p>
      <h1 className="mt-1 text-xl font-semibold">{describeBooking(appt.serviceName, addOns.map((a) => a.name))}</h1>
      <div className="mt-4 space-y-1 rounded-xl bg-zinc-50 p-4 text-sm">
        <p><span className="text-zinc-500">Cliente:</span> {appt.client.name}</p>
        <p><span className="text-zinc-500">Profissional:</span> {appt.professional.name}</p>
        <p><span className="text-zinc-500">Data:</span> {fmtDate(appt.startsAt, tz)} às {fmtTime(appt.startsAt, tz)}</p>
        <p><span className="text-zinc-500">Valor:</span> {formatCents(appt.priceCents)}</p>
        <p className="pt-1"><StatusBadge status={appt.status} /></p>
      </div>

      {flash && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</p>}

      {appt.status === "AWAITING_PAYMENT" && payment?.status === "PENDING" && (
        <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          Falta pagar o sinal de <strong>{formatCents(payment.amountCents)}</strong> para confirmar.
          <Link href={`/pagar/${token}`} className="btn-accent mt-2 w-full">Pagar com Pix</Link>
        </div>
      )}
      {payment?.status === "PAID" && <p className="mt-3 text-xs text-emerald-700">Sinal de {formatCents(payment.amountCents)} pago via Pix.</p>}
      {payment?.status === "REFUNDED" && <p className="mt-3 text-xs text-sky-700">Sinal de {formatCents(payment.amountCents)} estornado.</p>}

      {isActive && (
        <ConfirmButtons
          token={token}
          canConfirm={appt.status !== "CONFIRMED" && appt.status !== "AWAITING_PAYMENT" && appt.status !== "RESCHEDULE_REQUESTED" && appt.startsAt > new Date()}
          canReschedule={(appt.status === "CONFIRMED" || appt.status === "AWAITING_CONFIRMATION") && appt.startsAt > new Date()}
          canCancel={cancelPolicy.ok}
          cancelReason={cancelPolicy.ok ? null : cancelPolicy.reason}
        />
      )}

      {policies.length > 0 && (
        <details className="mt-5 rounded-lg border border-zinc-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-700">Políticas de atendimento</summary>
          <ul className="mt-2 space-y-2 text-xs text-zinc-600">
            {policies.map((p) => <li key={p.title}><span className="font-medium text-zinc-700">{p.icon} {p.title}:</span> {p.text}</li>)}
          </ul>
        </details>
      )}

      <p className="mt-8 text-center text-xs text-zinc-400">
        Precisa de outro horário?{" "}
        <Link href={`/agendar/${appt.tenant.slug}`} className="underline">Faça um novo agendamento</Link>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-100 px-4 py-10">
      <div className="card w-full max-w-md p-6">{children}</div>
    </main>
  );
}

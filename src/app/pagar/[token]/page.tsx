import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, fmtTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { describeProfessionals } from "@/lib/appointments/summary";
import { PixPayment } from "./pix-payment";

export const metadata: Metadata = { title: "Pagar sinal" };

export default async function PayPage({ params }: PageProps<"/pagar/[token]">) {
  const { token } = await params;
  const appt = await db.appointment.findUnique({
    where: { confirmationToken: token },
    include: { tenant: true, client: true, payment: true, items: { orderBy: { sortOrder: "asc" }, include: { professional: { select: { name: true } } } } },
  });

  if (!appt || !appt.payment) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Link inválido</h1>
        <p className="mt-2 text-sm text-zinc-600">Não encontramos uma cobrança para este agendamento.</p>
      </Shell>
    );
  }

  const tz = appt.tenant.timezone;
  const p = appt.payment;

  return (
    <Shell>
      <p className="text-sm text-zinc-500">{appt.tenant.businessName}</p>
      <h1 className="mt-1 text-xl font-semibold">Sinal de {formatCents(p.amountCents)}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {appt.serviceName} com {describeProfessionals(appt.items)} · {fmtDate(appt.startsAt, tz)} às {fmtTime(appt.startsAt, tz)}
        <span className="text-zinc-400"> · valor do serviço {formatCents(appt.priceCents)}</span>
      </p>

      <div className="mt-5">
        <PixPayment
          token={token}
          initialPaymentStatus={p.status}
          initialAppointmentStatus={appt.status}
          copyPaste={p.pixCopyPaste}
          qrCodeBase64={p.pixQrCodeBase64}
          expiresAt={p.expiresAt.toISOString()}
          isMock={p.provider === "mock" && process.env.NODE_ENV !== "production"}
          confirmUrl={`/confirmar/${token}`}
        />
      </div>

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

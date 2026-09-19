import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { decryptSecret, maskSecret } from "@/lib/crypto";
import { getPixProvider, pixProviderName } from "@/lib/payments";
import { fmtDateTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { PaymentSettingsForm } from "./payment-form";

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "Aguardando", PAID: "Pago", EXPIRED: "Expirado", CANCELLED: "Cancelado", REFUNDED: "Estornado", FAILED: "Falhou",
};

export default async function PaymentSettingsPage() {
  const { tenant } = await requireAuth();
  const providerName = pixProviderName(tenant);
  const health = await getPixProvider(tenant).healthCheck().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  const recent = await db.payment.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { appointment: { select: { id: true, serviceName: true, startsAt: true, client: { select: { name: true } } } } },
  });
  const paidMonth = await db.payment.aggregate({
    where: { tenantId: tenant.id, status: "PAID", paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
    _sum: { amountCents: true }, _count: true,
  });

  return (
    <div className="space-y-6">
      <PaymentSettingsForm
        initial={{
          depositMode: tenant.depositMode,
          depositPercent: tenant.depositMode === "PERCENT" ? tenant.depositValue : 30,
          depositFixed: tenant.depositMode === "FIXED" ? (tenant.depositValue / 100).toFixed(2).replace(".", ",") : "20,00",
          depositTimeoutMinutes: tenant.depositTimeoutMinutes,
          pixProvider: providerName === "mercadopago" ? "mercadopago" : "mock",
          tokenMasked: tenant.pixCredentialsEnc ? maskSecret(decryptSecret(tenant.pixCredentialsEnc)) : null,
          envTokenAvailable: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
        }}
        health={health}
      />

      <section className="card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Sinais recebidos</h2>
          <p className="text-sm text-zinc-500">
            Este mês: <span className="font-medium text-zinc-800">{formatCents(paidMonth._sum.amountCents ?? 0)}</span> em {paidMonth._count} pagamento(s)
          </p>
        </div>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nenhuma cobrança gerada ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "PAID" ? "bg-emerald-100 text-emerald-800" : p.status === "REFUNDED" ? "bg-sky-100 text-sky-800" : p.status === "PENDING" ? "bg-violet-100 text-violet-800" : "bg-zinc-100 text-zinc-600"}`}>
                  {PAYMENT_LABEL[p.status] ?? p.status}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <a href={`/app/agendamentos/${p.appointment.id}`} className="hover:underline">{p.appointment.client.name}</a> · {p.appointment.serviceName} · {fmtDateTime(p.appointment.startsAt, tenant.timezone)}
                  {p.error && <span className="ml-2 text-xs text-rose-600">{p.error}</span>}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{formatCents(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

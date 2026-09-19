import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { addDaysToKey, fmtDate, fmtTime, todayKey, zonedDateTimeToUtc } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { summarizeCommissions } from "@/lib/commissions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/dashboard/avatar";
import { MarkPaidButton } from "./mark-paid-button";

export const metadata: Metadata = { title: "Comissões" };

const MONTH_RE = /^\d{4}-\d{2}$/;

/** Primeiro e último dia do mês "YYYY-MM" como DateKey. */
function monthRange(month: string) {
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from, toExclusive: next, to: addDaysToKey(next, -1) };
}
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthLabel = (month: string) => { const [y, m] = month.split("-").map(Number); return `${MONTHS[m - 1]} de ${y}`; };

/**
 * Fechamento de comissões (SPEC §17). OWNER vê a equipe toda e acerta; STAFF vê só a própria.
 * Conta itens de visitas CONCLUÍDAS no mês, pelo início do item no fuso do salão.
 */
export default async function CommissionsPage({ searchParams }: PageProps<"/app/comissoes">) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  if (ctx.role === "RECEPTION") redirect("/app"); // recepção não vê comissões (SPEC §6)
  const { tenant } = ctx;
  const tz = tenant.timezone;
  const month = typeof sp.mes === "string" && MONTH_RE.test(sp.mes) ? sp.mes : todayKey(tz).slice(0, 7);
  const { from, toExclusive, to } = monthRange(month);
  const fromUtc = zonedDateTimeToUtc(from, 0, tz);
  const toUtc = zonedDateTimeToUtc(toExclusive, 0, tz);
  const proIds = ctx.professionals.map((p) => p.id);

  const items = await db.appointmentItem.findMany({
    where: { tenantId: tenant.id, professionalId: { in: proIds }, appointment: { status: "COMPLETED" }, startsAt: { gte: fromUtc, lt: toUtc } },
    include: { appointment: { select: { id: true, client: { select: { name: true } } } } },
    orderBy: { startsAt: "asc" },
  });
  const byPro = new Map<string, typeof items>();
  for (const it of items) byPro.set(it.professionalId, [...(byPro.get(it.professionalId) ?? []), it]);
  const total = summarizeCommissions(items);
  const detailFor = typeof sp.pro === "string" ? sp.pro : null;

  return (
    <>
      <PageHeader
        title="Comissões"
        description={ctx.canManage ? "Fechamento por profissional: o que foi apurado nas visitas concluídas e o que ainda falta acertar." : "Sua comissão nas visitas concluídas."}
        actions={
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/app/comissoes?mes=${shiftMonth(month, -1)}`} className="btn-ghost px-2 py-1">‹</Link>
            <span className="min-w-40 text-center font-medium capitalize">{monthLabel(month)}</span>
            <Link href={`/app/comissoes?mes=${shiftMonth(month, 1)}`} className="btn-ghost px-2 py-1">›</Link>
          </div>
        }
      />

      {items.length === 0 ? (
        <EmptyState title="Nenhuma visita concluída neste mês" description="A comissão é apurada quando a visita é marcada como concluída na agenda." />
      ) : (
        <div className="space-y-6">
          {ctx.canManage && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Serviços concluídos" value={String(total.count)} />
              <Stat label="Faturamento" value={formatCents(total.revenueCents)} />
              <Stat label="Comissões" value={formatCents(total.commissionCents)} />
              <Stat label="Pendente" value={formatCents(total.pendingCents)} tone={total.pendingCents > 0 ? "warn" : "ok"} />
            </div>
          )}

          <div className="card divide-y divide-zinc-100">
            {ctx.professionals.filter((p) => byPro.has(p.id)).map((p) => {
              const list = byPro.get(p.id)!;
              const s = summarizeCommissions(list);
              const open = detailFor === p.id;
              return (
                <div key={p.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex min-w-48 items-center gap-2">
                      <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-zinc-500">{p.commissionPercent != null ? `${p.commissionPercent}% padrão` : "sem comissão padrão"}</p>
                      </div>
                    </div>
                    <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                      <Cell k="Serviços" v={String(s.count)} />
                      <Cell k="Faturamento" v={formatCents(s.revenueCents)} />
                      <Cell k="Comissão" v={formatCents(s.commissionCents)} />
                      <Cell k="Pendente" v={formatCents(s.pendingCents)} strong={s.pendingCents > 0} />
                    </dl>
                    <div className="flex items-center gap-3">
                      <Link href={`/app/comissoes?mes=${month}${open ? "" : `&pro=${p.id}`}`} className="text-xs text-brand-700 hover:underline">{open ? "Ocultar" : "Detalhar"}</Link>
                      {ctx.canManage && <MarkPaidButton professionalId={p.id} fromIso={fromUtc.toISOString()} toIso={toUtc.toISOString()} pendingCents={s.pendingCents} />}
                    </div>
                  </div>
                  {open && (
                    <table className="mt-3 w-full text-xs">
                      <thead className="text-left text-zinc-500">
                        <tr><th className="py-1 font-normal">Quando</th><th className="font-normal">Cliente</th><th className="font-normal">Serviço</th><th className="text-right font-normal">Valor</th><th className="text-right font-normal">Comissão</th><th className="text-right font-normal">Situação</th></tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {list.map((it) => (
                          <tr key={it.id}>
                            <td className="py-1.5 tabular-nums">{fmtDate(it.startsAt, tz, "dd/MM")} {fmtTime(it.startsAt, tz)}</td>
                            <td><Link href={`/app/agendamentos/${it.appointment.id}`} className="hover:underline">{it.appointment.client.name}</Link></td>
                            <td>{it.serviceName}</td>
                            <td className="text-right tabular-nums">{formatCents(it.priceCents)}</td>
                            <td className="text-right tabular-nums">{it.commissionCents != null ? formatCents(it.commissionCents) : "—"}</td>
                            <td className="text-right">{it.commissionCents == null ? <span className="text-zinc-400">sem regra</span> : it.commissionPaidAt ? <span className="text-emerald-700">pago {fmtDate(it.commissionPaidAt, tz, "dd/MM")}</span> : <span className="text-amber-700">pendente</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-zinc-400">Período: {fmtDate(fromUtc, tz)} a {to.split("-").reverse().join("/")}. A comissão fica gravada na visita no momento da conclusão; mudar o percentual depois não altera fechamentos anteriores.</p>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "ok" }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : ""}`}>{value}</p>
    </div>
  );
}

function Cell({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold text-amber-700" : ""}`}>{v}</dd>
    </div>
  );
}

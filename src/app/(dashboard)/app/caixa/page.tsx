import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { caixaAbertoDe, situacaoDoCaixa } from "@/lib/finance/db";
import { diferencaDoCaixa, rotuloDoCaixa } from "@/lib/finance/rules";
import { CashMovementForm, CloseCashForm, OpenCashForm } from "./cash-forms";

export const metadata: Metadata = { title: "Caixa" };

const ROTULO = { confere: { t: "Confere", c: "tag-ok" }, sobra: { t: "Sobra", c: "tag-warn" }, falta: { t: "Falta", c: "tag-bad" } } as const;

export default async function CaixaPage() {
  const ctx = await requireAuth();
  if (!ctx.seesTeam) redirect("/app");
  const { tenant } = ctx;
  const tz = tenant.timezone;

  const aberto = await caixaAbertoDe(tenant.id);
  const [atual, historico] = await Promise.all([
    aberto ? situacaoDoCaixa(aberto) : null,
    db.cashSession.findMany({ where: { tenantId: tenant.id, closedAt: { not: null } }, orderBy: { closedAt: "desc" }, take: 15 }),
  ]);

  return (
    <>
      <PageHeader title="Caixa" description="A gaveta de dinheiro do dia: abra com o troco, lance sangrias e suprimentos e feche contando o que há nela."
        actions={ctx.canManage ? <Link href="/app/financeiro" className="btn-secondary">Financeiro</Link> : undefined} />

      {!aberto || !atual ? (
        <section className="card mb-6 p-5">
          <h2 className="font-medium">Caixa fechado</h2>
          <p className="mb-3 text-sm text-zinc-500">Abra o caixa para acompanhar o dinheiro recebido e as despesas pagas em dinheiro.</p>
          <OpenCashForm />
        </section>
      ) : (
        <div className="mb-6 space-y-4">
          <section className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">Caixa aberto <span className="font-normal text-zinc-500">desde {fmtDateTime(aberto.openedAt, tz)}</span></h2>
              <p className="text-2xl font-semibold tabular-nums">{formatCents(atual.esperadoCents)} <span className="text-xs font-normal text-zinc-500">na gaveta (esperado)</span></p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-5">
              <Cell k="Troco inicial" v={formatCents(atual.entrada.openingCents)} />
              <Cell k={`Recebido em dinheiro (${atual.atendimentos})`} v={`+ ${formatCents(atual.entrada.recebidoDinheiroCents)}`} />
              <Cell k="Suprimentos" v={`+ ${formatCents(atual.entrada.suprimentoCents)}`} />
              <Cell k="Despesas em dinheiro" v={`− ${formatCents(atual.entrada.despesasDinheiroCents)}`} />
              <Cell k="Sangrias" v={`− ${formatCents(atual.entrada.sangriaCents)}`} />
            </dl>
            <p className="mt-3 text-xs text-mut">Só entra aqui o atendimento concluído com a forma de pagamento “Dinheiro”.</p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-medium">Sangria ou suprimento</h2>
            <CashMovementForm />
            {atual.movimentos.length > 0 && (
              <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                {atual.movimentos.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 py-1.5">
                    <span>{fmtDateTime(m.createdAt, tz)} · {m.kind === "SUPPLY" ? "Suprimento" : "Sangria"}{m.note ? ` · ${m.note}` : ""}</span>
                    <span className={`tabular-nums ${m.kind === "SUPPLY" ? "text-emerald-700" : "text-rose-700"}`}>{m.kind === "SUPPLY" ? "+" : "−"} {formatCents(m.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-medium">Fechar o caixa</h2>
            <CloseCashForm esperadoLabel={formatCents(atual.esperadoCents)} />
          </section>
        </div>
      )}

      <section className="card">
        <div className="border-b border-zinc-100 px-4 py-3"><h2 className="font-medium">Últimos fechamentos</h2></div>
        {historico.length === 0 ? <p className="px-4 py-6 text-center text-sm text-zinc-500">Nenhum caixa fechado ainda.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500"><tr><th className="px-4 py-2 font-normal">Aberto</th><th className="font-normal">Fechado</th><th className="text-right font-normal">Esperado</th><th className="text-right font-normal">Contado</th><th className="px-4 text-right font-normal">Diferença</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {historico.map((s) => {
                  const dif = diferencaDoCaixa(s.countedCents ?? 0, s.expectedCents ?? 0);
                  const r = ROTULO[rotuloDoCaixa(dif)];
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums">{fmtDateTime(s.openedAt, tz)}</td>
                      <td className="whitespace-nowrap tabular-nums">{s.closedAt ? fmtDateTime(s.closedAt, tz) : "—"}</td>
                      <td className="text-right tabular-nums">{formatCents(s.expectedCents ?? 0)}</td>
                      <td className="text-right tabular-nums">{formatCents(s.countedCents ?? 0)}</td>
                      <td className="px-4 text-right"><span className={`tag ${r.c}`}>{r.t}{dif !== 0 ? ` ${formatCents(Math.abs(dif))}` : ""}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

const Cell = ({ k, v }: { k: string; v: string }) => <div><dt className="text-xs text-zinc-500">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>;

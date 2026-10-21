import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { parsePeriodo } from "@/lib/reports/load";
import { addDaysToKey, todayKey } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { despesasDoPeriodo, receitasDoPeriodo } from "@/lib/finance/db";
import { resumoFinanceiro } from "@/lib/finance/rules";
import { ExpensesManager } from "./expenses-manager";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinanceiroPage({ searchParams }: PageProps<"/app/financeiro">) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const { tenant } = ctx;
  const periodo = parsePeriodo(sp, tenant.timezone);
  const [receitas, despesas] = await Promise.all([receitasDoPeriodo(tenant, periodo), despesasDoPeriodo(tenant.id, periodo)]);
  const r = resumoFinanceiro(receitas, despesas);
  const hoje = todayKey(tenant.timezone);
  const atalhos = [
    { rotulo: "Este mês", de: `${hoje.slice(0, 7)}-01`, ate: hoje },
    { rotulo: "Últimos 30 dias", de: addDaysToKey(hoje, -29), ate: hoje },
    { rotulo: "Este ano", de: `${hoje.slice(0, 4)}-01-01`, ate: hoje },
  ];
  const maxForma = Math.max(1, ...r.porForma.map((f) => f.cents));
  const maxCat = Math.max(1, ...r.porCategoria.map((f) => f.cents));

  return (
    <>
      <PageHeader title="Financeiro" description="O que entrou (atendimentos concluídos), o que saiu (despesas) e o resultado do período." actions={<Link href="/app/caixa" className="btn-secondary">Caixa</Link>} />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div><label className="label" htmlFor="de">De</label><input id="de" name="de" type="date" className="input" defaultValue={periodo.de} /></div>
        <div><label className="label" htmlFor="ate">Até</label><input id="ate" name="ate" type="date" className="input" defaultValue={periodo.ate} /></div>
        <button className="btn-primary">Ver período</button>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {atalhos.map((a) => (
            <Link key={a.rotulo} href={`/app/financeiro?de=${a.de}&ate=${a.ate}`} className={`rounded-full border px-2.5 py-1 ${a.de === periodo.de && a.ate === periodo.ate ? "border-brand-500 bg-brand-50 text-brand-800" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"}`}>{a.rotulo}</Link>
          ))}
        </div>
      </form>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Entrou" value={formatCents(r.receitaCents)} nota={`${receitas.length} atendimento${receitas.length === 1 ? "" : "s"} concluído${receitas.length === 1 ? "" : "s"}`} />
        <Stat label="Saiu" value={formatCents(r.despesaCents)} nota={`${despesas.length} despesa${despesas.length === 1 ? "" : "s"}`} />
        <Stat label="Resultado" value={formatCents(r.resultadoCents)} tone={r.resultadoCents < 0 ? "bad" : "ok"} nota={r.margem == null ? undefined : `${Math.round(r.margem * 100)}% de margem`} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Barras titulo="Entradas por forma de pagamento" vazio="Sem atendimentos concluídos no período." linhas={r.porForma} max={maxForma} cor="bg-emerald-500" />
        <Barras titulo="Despesas por categoria" vazio="Sem despesas no período." linhas={r.porCategoria} max={maxCat} cor="bg-rose-400" />
      </div>
      {r.porForma.some((f) => f.nome === "Não informado") && (
        <p className="mb-4 text-xs text-mut">“Não informado” são atendimentos concluídos sem a forma de pagamento. Abra o atendimento para informar.</p>
      )}

      <ExpensesManager expenses={despesas} today={hoje} />
    </>
  );
}

function Stat({ label, value, nota, tone }: { label: string; value: string; nota?: string; tone?: "ok" | "bad" }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "bad" ? "text-rose-700" : ""}`}>{value}</p>
      {nota && <p className="mt-0.5 text-[11px] text-mut">{nota}</p>}
    </div>
  );
}

function Barras({ titulo, linhas, max, cor, vazio }: { titulo: string; linhas: { nome: string; cents: number }[]; max: number; cor: string; vazio: string }) {
  return (
    <section className="card min-w-0 p-4">
      <div className="card-hd"><h2 className="card-title">{titulo}</h2></div>
      {linhas.length === 0 ? <p className="py-6 text-center text-sm text-mut">{vazio}</p> : (
        <ul className="space-y-2.5">
          {linhas.map((l) => (
            <li key={l.nome}>
              <div className="flex justify-between text-sm"><span>{l.nome}</span><span className="tabular-nums text-ink-2">{formatCents(l.cents)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-zinc-100"><div className={`h-1.5 rounded-full ${cor}`} style={{ width: `${Math.max(3, (l.cents / max) * 100)}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

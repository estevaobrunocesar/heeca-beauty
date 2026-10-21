import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { carregarRelatorio, parsePeriodo } from "@/lib/reports/load";
import { addDaysToKey, dateKeyToDate, todayKey } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AreaChart } from "@/components/dashboard/charts";

export const metadata: Metadata = { title: "Relatórios" };

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const dia = (key: string) => key.slice(8, 10) + "/" + key.slice(5, 7);

export default async function RelatoriosPage({ searchParams }: PageProps<"/app/relatorios">) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const tz = ctx.tenant.timezone;
  const periodo = parsePeriodo(sp, tz);
  const unidades = await db.unit.findMany({ where: { tenantId: ctx.tenant.id, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  const unidade = unidades.length >= 2 && typeof sp.unidade === "string" ? unidades.find((u) => u.id === sp.unidade) ?? null : null;
  const { relatorio: r } = await carregarRelatorio(ctx.tenant, periodo, unidade?.id);

  const hoje = todayKey(tz);
  const atalhos = [
    { rotulo: "Este mês", de: `${hoje.slice(0, 7)}-01`, ate: hoje },
    { rotulo: "Últimos 30 dias", de: addDaysToKey(hoje, -29), ate: hoje },
    { rotulo: "Últimos 90 dias", de: addDaysToKey(hoje, -89), ate: hoje },
    { rotulo: "Este ano", de: `${hoje.slice(0, 4)}-01-01`, ate: hoje },
  ];
  const qs = `de=${periodo.de}&ate=${periodo.ate}${unidade ? `&unidade=${unidade.id}` : ""}`;
  const serie = r.porDia.map((p) => ({ rotulo: dia(p.dia), valor: p.cents / 100 }));
  const maxCat = Math.max(1, ...r.categorias.map((c) => c.faturamentoCents));

  return (
    <>
      <PageHeader title="Relatórios" description="Faturamento, atendimentos, equipe e clientes de qualquer período." />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div><label className="label" htmlFor="de">De</label><input id="de" name="de" type="date" className="input" defaultValue={periodo.de} /></div>
        <div><label className="label" htmlFor="ate">Até</label><input id="ate" name="ate" type="date" className="input" defaultValue={periodo.ate} /></div>
        {unidades.length >= 2 && (
          <div>
            <label className="label" htmlFor="unidade">Unidade</label>
            <select id="unidade" name="unidade" className="input" defaultValue={unidade?.id ?? ""}>
              <option value="">Todas</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        <button className="btn-primary">Ver período</button>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {atalhos.map((a) => (
            <Link key={a.rotulo} href={`/app/relatorios?de=${a.de}&ate=${a.ate}${unidade ? `&unidade=${unidade.id}` : ""}`} className={`rounded-full border px-2.5 py-1 ${a.de === periodo.de && a.ate === periodo.ate ? "border-brand-500 bg-brand-50 text-brand-800" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"}`}>{a.rotulo}</Link>
          ))}
        </div>
      </form>

      {r.total === 0 ? (
        <EmptyState title="Nenhum agendamento neste período" description="Escolha outro período para ver os números." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Faturamento" value={formatCents(r.faturamentoCents)} nota={r.adicionaisCents > 0 ? `${formatCents(r.servicosCents)} em serviços + ${formatCents(r.adicionaisCents)} adicionais` : undefined} />
            <Stat label="Atendimentos concluídos" value={String(r.concluidos)} nota={`${r.abertos} em aberto · ${r.cancelados} cancelados`} />
            <Stat label="Ticket médio" value={r.concluidos ? formatCents(r.ticketMedioCents) : "—"} />
            <Stat label="Faltas" value={String(r.faltas)} nota={`${pct(r.taxaFaltas)} de quem era esperada`} />
          </div>

          <section className="card min-w-0 p-4">
            <div className="card-hd"><h2 className="card-title">Faturamento por dia</h2><Exportar tipo="atendimentos" qs={qs} rotulo="Baixar atendimentos" /></div>
            {serie.length < 2 ? <p className="py-8 text-center text-sm text-mut">Dias suficientes para o gráfico só com 2 ou mais dias com atendimentos concluídos.</p> : <AreaChart pontos={serie} formato={(v) => `R$ ${Math.round(v)}`} />}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card min-w-0 p-4">
              <div className="card-hd"><h2 className="card-title">Por profissional</h2><Exportar tipo="profissionais" qs={qs} rotulo="Baixar" /></div>
              <Tabela vazio="Sem atendimentos concluídos." cab={["Profissional", "Serv.", "Faturou", "Comissão"]}
                linhas={r.profissionais.map((p) => [p.nome, String(p.quantidade), formatCents(p.faturamentoCents), formatCents(p.comissaoCents)])} />
            </section>
            <section className="card min-w-0 p-4">
              <div className="card-hd"><h2 className="card-title">Serviços mais vendidos</h2><Exportar tipo="servicos" qs={qs} rotulo="Baixar" /></div>
              <Tabela vazio="Sem atendimentos concluídos." cab={["Serviço", "Qtd.", "Faturou"]}
                linhas={r.servicos.slice(0, 10).map((s) => [s.nome, String(s.quantidade), formatCents(s.faturamentoCents)])} />
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card min-w-0 p-4">
              <div className="card-hd"><h2 className="card-title">Por categoria</h2></div>
              {r.categorias.length === 0 ? <p className="py-6 text-center text-sm text-mut">Sem atendimentos concluídos.</p> : (
                <ul className="space-y-2.5">
                  {r.categorias.map((c) => (
                    <li key={c.id}>
                      <div className="flex justify-between text-sm"><span>{c.nome}</span><span className="tabular-nums text-ink-2">{formatCents(c.faturamentoCents)}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-100"><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.max(3, (c.faturamentoCents / maxCat) * 100)}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card min-w-0 p-4">
              <div className="card-hd"><h2 className="card-title">Clientes</h2><Exportar tipo="clientes" qs={qs} rotulo="Baixar melhores" /></div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <Mini k="Atendidas" v={r.clientes.atendidas} /><Mini k="Novas" v={r.clientes.novas} /><Mini k="Recorrentes" v={r.clientes.recorrentes} />
              </div>
              <Tabela vazio="Sem clientes atendidas." cab={["Melhores clientes", "Visitas", "Gastou"]}
                linhas={r.clientes.melhores.slice(0, 5).map((c) => [c.nome, String(c.visitas), formatCents(c.gastoCents)])} />
            </section>
          </div>

          <p className="text-xs text-mut">
            {pct(r.parcelaOnline)} dos agendamentos vieram pela página pública. O faturamento conta só atendimentos concluídos no período (de {dateKeyToDate(periodo.de).toLocaleDateString("pt-BR", { timeZone: "UTC" })} a {dateKeyToDate(periodo.ate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}), com os valores adicionais; a comissão considera só os serviços.
          </p>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, nota }: { label: string; value: string; nota?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {nota && <p className="mt-0.5 text-[11px] text-mut">{nota}</p>}
    </div>
  );
}
const Mini = ({ k, v }: { k: string; v: number }) => <div className="rounded-lg bg-zinc-50 py-2"><p className="text-lg font-semibold tabular-nums">{v}</p><p className="text-[11px] text-mut">{k}</p></div>;
const Exportar = ({ tipo, qs, rotulo }: { tipo: string; qs: string; rotulo: string }) => (
  <a href={`/api/relatorios?tipo=${tipo}&${qs}`} className="link-mut" download>{rotulo} (CSV) ›</a>
);

function Tabela({ cab, linhas, vazio }: { cab: string[]; linhas: string[][]; vazio: string }) {
  if (linhas.length === 0) return <p className="py-6 text-center text-sm text-mut">{vazio}</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-zinc-500">
        <tr>{cab.map((c, i) => <th key={c} className={`py-1 font-normal ${i > 0 ? "text-right" : ""}`}>{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {linhas.map((l, k) => (
          <tr key={k}>{l.map((c, i) => <td key={i} className={`py-1.5 ${i > 0 ? "text-right tabular-nums" : "max-w-40 truncate"}`}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

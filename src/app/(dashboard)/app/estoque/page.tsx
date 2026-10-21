import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { formatCents } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { saldosDoTenant } from "@/lib/stock/db";
import { precisaReposicao, situacaoDe, valorEmEstoqueCents, type Unit } from "@/lib/stock/rules";
import { ProductsManager, type ProductRow } from "./products-manager";

export const metadata: Metadata = { title: "Estoque" };

const PESO = { negativo: 0, zerado: 1, baixo: 2, ok: 3 } as const;

export default async function EstoquePage() {
  const ctx = await requireAuth();
  if (!ctx.can("estoque")) redirect("/app");
  const { tenant } = ctx;

  const [produtos, saldos] = await Promise.all([
    db.product.findMany({ where: { tenantId: tenant.id }, include: { _count: { select: { services: true } } } }),
    saldosDoTenant(tenant.id),
  ]);

  const linhas: ProductRow[] = produtos
    .map((p) => {
      const saldo = saldos.get(p.id) ?? 0;
      return { id: p.id, name: p.name, unit: p.unit as Unit, costCents: p.costCents, minQuantity: p.minQuantity, notes: p.notes, active: p.active, saldo, situacao: situacaoDe(saldo, p.minQuantity), usadoEm: p._count.services };
    })
    // Quem precisa de atenção vem primeiro; desativados por último.
    .sort((a, b) => Number(!a.active) - Number(!b.active) || PESO[a.situacao] - PESO[b.situacao] || a.name.localeCompare(b.name, "pt-BR"));

  const ativos = linhas.filter((l) => l.active);
  const repor = ativos.filter((l) => precisaReposicao(l.situacao));
  const valor = valorEmEstoqueCents(ativos);

  return (
    <>
      <PageHeader title="Estoque" description="Os produtos do estabelecimento: entradas, saídas e baixa automática a cada atendimento concluído." />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Produtos ativos" value={String(ativos.length)} />
        <Stat label="Precisam de reposição" value={String(repor.length)} tone={repor.length ? "warn" : "ok"} nota={repor.length ? repor.slice(0, 3).map((r) => r.name).join(", ") + (repor.length > 3 ? "…" : "") : undefined} />
        <Stat label="Valor em estoque (a custo)" value={formatCents(valor)} nota="Só produtos com custo informado" />
      </div>
      <ProductsManager products={linhas} />
      <p className="mt-3 text-xs text-mut">Para a baixa automática, abra o serviço em Serviços e informe quanto de cada produto ele usa por atendimento. Se o saldo ficar negativo, é sinal de entrada não lançada: use “Lançar → Acertar contagem”.</p>
    </>
  );
}

function Stat({ label, value, nota, tone }: { label: string; value: string; nota?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-700" : ""}`}>{value}</p>
      {nota && <p className="mt-0.5 truncate text-[11px] text-mut">{nota}</p>}
    </div>
  );
}

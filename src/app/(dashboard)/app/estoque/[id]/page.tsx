import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { saldosDoTenant } from "@/lib/stock/db";
import { KIND_LABEL, situacaoDe, type MovementKind } from "@/lib/stock/rules";

const MAX = 200;

export default async function HistoricoDoProdutoPage({ params }: PageProps<"/app/estoque/[id]">) {
  const { id } = await params;
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const { tenant } = ctx;

  const produto = await db.product.findFirst({ where: { id, tenantId: tenant.id } });
  if (!produto) notFound();
  const [movs, saldos] = await Promise.all([
    db.stockMovement.findMany({
      where: { productId: id, tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: MAX,
      include: { appointment: { select: { id: true, serviceName: true, client: { select: { name: true } } } } },
    }),
    saldosDoTenant(tenant.id, [id]),
  ]);
  const saldo = saldos.get(id) ?? 0;
  const situacao = situacaoDe(saldo, produto.minQuantity);

  return (
    <>
      <PageHeader
        title={produto.name}
        description={`Saldo atual: ${saldo.toLocaleString("pt-BR")} ${produto.unit}${produto.minQuantity > 0 ? ` · avisa em ${produto.minQuantity.toLocaleString("pt-BR")} ou menos` : ""}${situacao !== "ok" ? ` · ${situacao}` : ""}`}
        actions={<Link href="/app/estoque" className="btn-secondary">‹ Estoque</Link>}
      />
      <section className="card">
        {movs.length === 0 ? <p className="px-4 py-8 text-center text-sm text-zinc-500">Nenhum lançamento ainda.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr><th className="px-4 py-2 font-normal">Quando</th><th className="font-normal">O que</th><th className="text-right font-normal">Quantidade</th><th className="px-4 font-normal">Detalhe</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{fmtDateTime(m.createdAt, tenant.timezone)}</td>
                    <td>{KIND_LABEL[m.kind as MovementKind]}</td>
                    <td className={`text-right font-medium tabular-nums ${m.quantity < 0 ? "text-rose-700" : "text-emerald-700"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity.toLocaleString("pt-BR")} {produto.unit}</td>
                    <td className="px-4 text-xs text-zinc-500">
                      {m.appointment ? <Link href={`/app/agendamentos/${m.appointment.id}`} className="text-brand-700 hover:underline">{m.appointment.client.name} · {m.appointment.serviceName}</Link> : m.note}
                      {m.appointment && m.note ? ` · ${m.note}` : ""}
                      {m.unitCostCents != null && ` · ${formatCents(m.unitCostCents)}/${produto.unit}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {movs.length === MAX && <p className="mt-2 text-xs text-mut">Mostrando os {MAX} lançamentos mais recentes.</p>}
    </>
  );
}

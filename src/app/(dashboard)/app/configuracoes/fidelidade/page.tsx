import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { LoyaltyForm } from "./loyalty-form";

export default async function LoyaltySettingsPage() {
  const { tenant, canManage } = await requireAuth();
  const [emCirculacao, clientes] = await Promise.all([
    db.cashbackEntry.aggregate({ where: { tenantId: tenant.id }, _sum: { amountCents: true } }),
    db.cashbackEntry.groupBy({ by: ["clientId"], where: { tenantId: tenant.id }, _sum: { amountCents: true }, having: { amountCents: { _sum: { gt: 0 } } } }),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <LoyaltyForm initialPercent={tenant.cashbackPercent} canManage={canManage} />
      <aside className="card h-fit p-5">
        <h2 className="font-medium">Como funciona</h2>
        <ul className="mt-2 space-y-2 text-sm text-zinc-600">
          <li>Cada atendimento <strong>concluído</strong> devolve à cliente uma porcentagem do valor dos serviços (os valores adicionais não contam).</li>
          <li>O saldo aparece na ficha da cliente. Quando ela usar, registre o valor ali e dê o desconto no pagamento.</li>
          <li>Se o atendimento for reaberto, o cashback dele é estornado.</li>
        </ul>
        <p className="mt-4 text-xs text-zinc-500">Hoje: {clientes.length} cliente{clientes.length === 1 ? "" : "s"} com saldo, {formatCents(emCirculacao._sum.amountCents ?? 0)} em circulação.</p>
      </aside>
    </div>
  );
}

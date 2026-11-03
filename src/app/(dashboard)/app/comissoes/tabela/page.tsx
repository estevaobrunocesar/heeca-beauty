import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { formatCents } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableForm } from "./table-form";

export const metadata: Metadata = { title: "Tabela de comissões" };

/** Tabela de comissões padrão, uma por serviço, para todos. O acordo de cada pessoa fica no perfil dela, em Equipe. */
export default async function CommissionTablePage() {
  const ctx = await requireAuth();
  if (!ctx.can("equipe")) redirect("/app/comissoes");

  const services = await db.service.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null, isAddOn: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, priceCents: true, active: true, commissionPercent: true, commissionFixedCents: true },
  });

  return (
    <>
      <div className="mb-4"><Link href="/app/comissoes" className="text-sm text-zinc-500 hover:underline">‹ Comissões</Link></div>
      <PageHeader
        title="Tabela de comissões"
        description="A comissão padrão de cada serviço, igual para toda a equipe. Quem tem um acordo diferente neste serviço recebe o acordo, que se combina no perfil de cada pessoa em Equipe."
      />
      {services.length === 0 ? (
        <EmptyState title="Nenhum serviço cadastrado" description="Cadastre os serviços para definir a comissão de cada um." />
      ) : (
        <TableForm
          services={services.map((s) => ({
            id: s.id, name: s.name, active: s.active, price: formatCents(s.priceCents),
            percent: s.commissionPercent, fixedCents: s.commissionFixedCents,
          }))}
        />
      )}
    </>
  );
}

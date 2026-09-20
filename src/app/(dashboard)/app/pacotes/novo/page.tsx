import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { formatCents } from "@/lib/money";
import { todayKey } from "@/lib/dates";
import { SellForm } from "./sell-form";

/** Vender um pacote do catálogo a um cliente cadastrado (snapshot: escopo, sessões, validade e preço na venda). */
export default async function VenderPacotePage({ searchParams }: PageProps<"/app/pacotes/novo">) {
  const ctx = await requireAuth();
  if (!ctx.canManage) redirect("/app");
  const sp = await searchParams;
  const [pacotes, clientes] = await Promise.all([
    db.package.findMany({ where: { tenantId: ctx.tenant.id, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, sessionsCount: true, validityDays: true, priceCents: true } }),
    db.client.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
  ]);
  if (pacotes.length === 0) redirect("/app/pacotes");
  return (
    <>
      <PageHeader title="Vender pacote" description="O cliente precisa estar cadastrado (aparece após o primeiro agendamento ou em Clientes)." />
      <SellForm
        packages={pacotes.map((p) => ({ id: p.id, label: `${p.name} · ${p.sessionsCount} sessões · ${formatCents(p.priceCents)}${p.validityDays ? ` · ${p.validityDays} dias` : ""}`, price: (p.priceCents / 100).toFixed(2).replace(".", ",") }))}
        clients={clientes.map((c) => ({ id: c.id, label: `${c.name} · ${c.phone}` }))}
        defaultClientId={typeof sp.cliente === "string" ? sp.cliente : undefined}
        today={todayKey(ctx.tenant.timezone)}
      />
    </>
  );
}

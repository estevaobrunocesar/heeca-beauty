import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeProfessionals, requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { formatCents } from "@/lib/money";
import { phoneLabel } from "@/lib/phone";
import { todayKey } from "@/lib/dates";
import { moduloClinicoAtivo } from "@/lib/treatments/rules";
import { SellForm } from "./sell-form";

/**
 * Vender um pacote do catálogo — ou, no módulo clínico, um protocolo direto — a um cliente cadastrado
 * (snapshot: escopo, sessões, validade e preço na venda). Com `?avaliacao=<id>` vem pré-preenchido
 * pela avaliação (cliente, protocolo recomendado, sessões sugeridas, profissional).
 */
export default async function VenderPacotePage({ searchParams }: PageProps<"/app/pacotes/novo">) {
  const ctx = await requireAuth();
  if (!ctx.can("pacotes")) redirect("/app");
  const sp = await searchParams;
  const clinico = moduloClinicoAtivo(ctx.tenant.segmentos);
  const tenantId = ctx.tenant.id;

  const [pacotes, protocolos, clientes, avaliacao] = await Promise.all([
    db.package.findMany({ where: { tenantId, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, sessionsCount: true, validityDays: true, priceCents: true } }),
    clinico ? db.protocol.findMany({ where: { tenantId, active: true, steps: { some: {} } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, sessionsCount: true } }) : [],
    db.client.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
    clinico && typeof sp.avaliacao === "string"
      ? db.assessment.findFirst({ where: { id: sp.avaliacao, tenantId, plan: null }, select: { id: true, clientId: true, professionalId: true, suggestedSessions: true, recommendedProtocolId: true, client: { select: { name: true } } } })
      : null,
  ]);
  if (pacotes.length === 0 && protocolos.length === 0) redirect("/app/pacotes");

  const preferido = avaliacao?.recommendedProtocolId && protocolos.some((p) => p.id === avaliacao.recommendedProtocolId)
    ? `protocol:${avaliacao.recommendedProtocolId}`
    : undefined;

  return (
    <>
      <PageHeader
        title={avaliacao ? `Plano para ${avaliacao.client.name}` : "Vender pacote"}
        description={avaliacao ? "Criado a partir da avaliação: o plano fica ligado a ela." : "O cliente precisa estar cadastrado (aparece após o primeiro agendamento ou em Clientes)."}
      />
      <SellForm
        packages={pacotes.map((p) => ({ id: p.id, label: `${p.name} · ${p.sessionsCount} sessões · ${formatCents(p.priceCents)}${p.validityDays ? ` · ${p.validityDays} dias` : ""}`, price: (p.priceCents / 100).toFixed(2).replace(".", ",") }))}
        protocols={protocolos.map((p) => ({ id: p.id, label: `${p.name} · ${p.sessionsCount} sessões sugeridas`, sessions: p.sessionsCount }))}
        clients={clientes.map((c) => ({ id: c.id, label: `${c.name} · ${phoneLabel(c.phone)}` }))}
        professionals={clinico ? activeProfessionals(ctx).map((p) => ({ id: p.id, name: p.name })) : []}
        defaultClientId={avaliacao?.clientId ?? (typeof sp.cliente === "string" ? sp.cliente : undefined)}
        defaultSource={preferido}
        defaultSessions={avaliacao?.suggestedSessions ?? undefined}
        defaultProfessionalId={avaliacao?.professionalId}
        assessmentId={avaliacao?.id}
        today={todayKey(ctx.tenant.timezone)}
      />
    </>
  );
}

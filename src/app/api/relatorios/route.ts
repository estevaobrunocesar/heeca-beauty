import { NextResponse } from "next/server";
import { getSession, requireAuth } from "@/lib/auth/session";
import { carregarRelatorio, parsePeriodo } from "@/lib/reports/load";
import { reais, toCsv } from "@/lib/reports/csv";
import { fmtDate, fmtTime } from "@/lib/dates";

const TIPOS = ["atendimentos", "servicos", "profissionais", "clientes"] as const;
type Tipo = (typeof TIPOS)[number];

const STATUS: Record<string, string> = {
  PENDING: "Pendente", AWAITING_PAYMENT: "Aguardando pagamento", AWAITING_CONFIRMATION: "Aguardando confirmação", CONFIRMED: "Confirmado",
  RESCHEDULE_REQUESTED: "Pediu outro horário", CANCELLED_BY_CLIENT: "Cancelado pela cliente", CANCELLED_BY_PROFESSIONAL: "Cancelado pelo estabelecimento",
  COMPLETED: "Concluído", NO_SHOW: "Faltou",
};

/** GET /api/relatorios?tipo=atendimentos|servicos|profissionais|clientes&de=AAAA-MM-DD&ate=AAAA-MM-DD → CSV (só dono e gerente). */
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const ctx = await requireAuth();
  if (!ctx.canManage) return NextResponse.json({ ok: false, error: "Sem permissão para exportar relatórios." }, { status: 403 });

  const url = new URL(req.url);
  const tipo = (TIPOS as readonly string[]).includes(url.searchParams.get("tipo") ?? "") ? (url.searchParams.get("tipo") as Tipo) : "atendimentos";
  const tz = ctx.tenant.timezone;
  const periodo = parsePeriodo({ de: url.searchParams.get("de"), ate: url.searchParams.get("ate") }, tz);
  const unitId = url.searchParams.get("unidade");
  const { appointments, relatorio: r } = await carregarRelatorio(ctx.tenant, periodo, unitId);

  let csv: string;
  if (tipo === "atendimentos") {
    csv = toCsv(
      ["Data", "Hora", "Cliente", "Serviços", "Profissionais", "Situação", "Origem", "Serviços (R$)", "Adicionais (R$)", "Total (R$)"],
      appointments.map((a) => {
        const servicos = a.items.reduce((n, i) => n + i.priceCents, 0);
        return [
          fmtDate(a.startsAt, tz), fmtTime(a.startsAt, tz), a.clientName,
          a.items.map((i) => i.serviceName).join(" + "), [...new Set(a.items.map((i) => i.professionalName))].join(" + "),
          STATUS[a.status] ?? a.status, a.source === "PUBLIC" ? "Página pública" : "Painel",
          reais(servicos), reais(a.chargesCents), reais(servicos + a.chargesCents),
        ];
      }),
    );
  } else if (tipo === "servicos") {
    csv = toCsv(["Serviço", "Quantidade", "Faturamento (R$)"], r.servicos.map((s) => [s.nome, s.quantidade, reais(s.faturamentoCents)]));
  } else if (tipo === "profissionais") {
    csv = toCsv(["Profissional", "Serviços", "Faturamento (R$)", "Comissão (R$)"], r.profissionais.map((p) => [p.nome, p.quantidade, reais(p.faturamentoCents), reais(p.comissaoCents)]));
  } else {
    csv = toCsv(["Cliente", "Visitas", "Gasto (R$)"], r.clientes.melhores.map((c) => [c.nome, c.visitas, reais(c.gastoCents)]));
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${tipo}-${periodo.de}-a-${periodo.ate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

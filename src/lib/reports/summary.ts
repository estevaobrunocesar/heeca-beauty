import { toDateKey } from "@/lib/dates";

// Relatórios do estabelecimento. Puro: a página e a exportação CSV montam as linhas e daqui saem todos os números,
// para que a tela e o arquivo nunca discordem.

export type ReportItem = {
  professionalId: string; professionalName: string;
  serviceId: string; serviceName: string; categoryName: string | null;
  priceCents: number; commissionCents: number | null;
};
export type ReportAppointment = {
  id: string; startsAt: Date; status: string; source: string;
  clientId: string; clientName: string;
  items: ReportItem[]; chargesCents: number;
};

export type Linha = { id: string; nome: string; quantidade: number; faturamentoCents: number };
export type LinhaProfissional = Linha & { comissaoCents: number };
export type LinhaCliente = { id: string; nome: string; visitas: number; gastoCents: number };

const CANCELADOS = new Set(["CANCELLED_BY_CLIENT", "CANCELLED_BY_PROFESSIONAL"]);

/**
 * `clientesComHistorico`: ids que já tinham visita concluída antes do período. Quem atendeu no período e não está
 * aí é cliente nova.
 */
export function buildReport(appointments: ReportAppointment[], opts: { tz: string; clientesComHistorico: ReadonlySet<string> }) {
  let concluidos = 0, faltas = 0, cancelados = 0, abertos = 0, online = 0;
  let servicosCents = 0, adicionaisCents = 0, comissaoCents = 0;
  const pros = new Map<string, LinhaProfissional>();
  const servicos = new Map<string, Linha>();
  const categorias = new Map<string, Linha>();
  const clientes = new Map<string, LinhaCliente>();
  const porDia = new Map<string, number>();

  const somar = <T extends Linha>(m: Map<string, T>, id: string, nome: string, cents: number, novo: () => T): T => {
    const l = m.get(id) ?? novo();
    l.nome = nome; l.quantidade += 1; l.faturamentoCents += cents;
    m.set(id, l);
    return l;
  };

  for (const a of appointments) {
    if (a.source === "PUBLIC") online++;
    if (a.status === "NO_SHOW") { faltas++; continue; }
    if (CANCELADOS.has(a.status)) { cancelados++; continue; }
    if (a.status !== "COMPLETED") { abertos++; continue; }

    concluidos++;
    const doAtendimento = a.items.reduce((n, i) => n + i.priceCents, 0);
    servicosCents += doAtendimento;
    adicionaisCents += a.chargesCents;
    const dia = toDateKey(a.startsAt, opts.tz);
    porDia.set(dia, (porDia.get(dia) ?? 0) + doAtendimento + a.chargesCents);

    const c = clientes.get(a.clientId) ?? { id: a.clientId, nome: a.clientName, visitas: 0, gastoCents: 0 };
    c.visitas += 1; c.gastoCents += doAtendimento + a.chargesCents;
    clientes.set(a.clientId, c);

    for (const i of a.items) {
      const p = somar(pros, i.professionalId, i.professionalName, i.priceCents, () => ({ id: i.professionalId, nome: "", quantidade: 0, faturamentoCents: 0, comissaoCents: 0 }));
      p.comissaoCents += i.commissionCents ?? 0;
      comissaoCents += i.commissionCents ?? 0;
      somar(servicos, i.serviceId, i.serviceName, i.priceCents, () => ({ id: i.serviceId, nome: "", quantidade: 0, faturamentoCents: 0 }));
      const cat = i.categoryName ?? "Sem categoria";
      somar(categorias, cat, cat, i.priceCents, () => ({ id: cat, nome: "", quantidade: 0, faturamentoCents: 0 }));
    }
  }

  const porFaturamento = <T extends { faturamentoCents: number }>(m: Map<string, T>) => [...m.values()].sort((x, y) => y.faturamentoCents - x.faturamentoCents);
  const lista = [...clientes.values()];
  const novas = lista.filter((c) => !opts.clientesComHistorico.has(c.id)).length;
  const faturamentoCents = servicosCents + adicionaisCents;
  const comparecimento = concluidos + faltas;

  return {
    total: appointments.length,
    concluidos, faltas, cancelados, abertos,
    servicosCents, adicionaisCents, faturamentoCents, comissaoCents,
    ticketMedioCents: concluidos ? Math.round(faturamentoCents / concluidos) : 0,
    /** Faltas sobre quem era esperada (concluídos + faltas); null quando ninguém era esperada. */
    taxaFaltas: comparecimento ? faltas / comparecimento : null,
    /** Parcela dos agendamentos que veio pela página pública. */
    parcelaOnline: appointments.length ? online / appointments.length : null,
    profissionais: porFaturamento(pros),
    servicos: porFaturamento(servicos),
    categorias: porFaturamento(categorias),
    clientes: { atendidas: lista.length, novas, recorrentes: lista.length - novas, melhores: [...lista].sort((x, y) => y.gastoCents - x.gastoCents).slice(0, 10) },
    porDia: [...porDia.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).map(([dia, cents]) => ({ dia, cents })),
  };
}
export type Relatorio = ReturnType<typeof buildReport>;

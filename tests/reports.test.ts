import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReport, type ReportAppointment } from "../src/lib/reports/summary";
import { toCsv, celula, reais } from "../src/lib/reports/csv";

const TZ = "America/Sao_Paulo";
const item = (o: Partial<ReportAppointment["items"][number]> = {}) => ({
  professionalId: "ana", professionalName: "Ana", serviceId: "corte", serviceName: "Corte", categoryName: "Cabelo" as string | null,
  priceCents: 10000, commissionCents: 4000 as number | null, ...o,
});
const appt = (o: Partial<ReportAppointment> = {}): ReportAppointment => ({
  id: "a", startsAt: new Date("2026-10-20T15:00:00Z"), status: "COMPLETED", source: "PUBLIC",
  clientId: "c1", clientName: "Bia", items: [item()], chargesCents: 0, ...o,
});
const rel = (list: ReportAppointment[], hist: string[] = []) => buildReport(list, { tz: TZ, clientesComHistorico: new Set(hist) });

describe("relatório", () => {
  it("só concluídos entram no faturamento; faltas, cancelados e abertos são contados à parte", () => {
    const r = rel([appt(), appt({ id: "b", status: "NO_SHOW" }), appt({ id: "c", status: "CANCELLED_BY_CLIENT" }), appt({ id: "d", status: "CONFIRMED" })]);
    assert.deepEqual([r.concluidos, r.faltas, r.cancelados, r.abertos], [1, 1, 1, 1]);
    assert.equal(r.faturamentoCents, 10000);
  });
  it("adicionais entram no faturamento e no ticket médio, mas não na comissão", () => {
    const r = rel([appt({ chargesCents: 2000 }), appt({ id: "b", clientId: "c2", chargesCents: 0 })]);
    assert.equal(r.servicosCents, 20000);
    assert.equal(r.adicionaisCents, 2000);
    assert.equal(r.faturamentoCents, 22000);
    assert.equal(r.ticketMedioCents, 11000);
    assert.equal(r.comissaoCents, 8000);
  });
  it("taxa de faltas = faltas / (concluídos + faltas); sem ninguém esperada é null", () => {
    assert.equal(rel([appt(), appt({ id: "b", status: "NO_SHOW" })]).taxaFaltas, 0.5);
    assert.equal(rel([appt({ status: "CANCELLED_BY_CLIENT" })]).taxaFaltas, null);
  });
  it("agrupa por profissional, serviço e categoria, do maior para o menor faturamento", () => {
    const r = rel([
      appt({ items: [item(), item({ professionalId: "bia", professionalName: "Bia", serviceId: "unha", serviceName: "Unha", categoryName: null, priceCents: 5000, commissionCents: null })] }),
    ]);
    assert.deepEqual(r.profissionais.map((p) => [p.nome, p.faturamentoCents, p.comissaoCents]), [["Ana", 10000, 4000], ["Bia", 5000, 0]]);
    assert.deepEqual(r.servicos.map((s) => s.nome), ["Corte", "Unha"]);
    assert.deepEqual(r.categorias.map((c) => c.nome), ["Cabelo", "Sem categoria"]);
  });
  it("clientes novas são as sem visita concluída antes do período", () => {
    const r = rel([appt(), appt({ id: "b", clientId: "c2", clientName: "Cris" }), appt({ id: "c" })], ["c2"]);
    assert.deepEqual([r.clientes.atendidas, r.clientes.novas, r.clientes.recorrentes], [2, 1, 1]);
    assert.equal(r.clientes.melhores[0].nome, "Bia");
    assert.equal(r.clientes.melhores[0].visitas, 2);
  });
  it("série por dia usa o fuso do estabelecimento (23h30 de Brasília ainda é o mesmo dia)", () => {
    const r = rel([appt({ startsAt: new Date("2026-10-21T02:30:00Z") })]);
    assert.deepEqual(r.porDia, [{ dia: "2026-10-20", cents: 10000 }]);
  });
  it("parcela online conta a origem pública sobre todos os agendamentos", () => {
    assert.equal(rel([appt(), appt({ id: "b", source: "DASHBOARD" })]).parcelaOnline, 0.5);
    assert.equal(rel([]).parcelaOnline, null);
  });
});

describe("csv", () => {
  it("usa ; e BOM, escapa aspas e separadores", () => {
    assert.equal(toCsv(["a", "b"], [["x;y", 'diz "oi"']]), '﻿a;b\r\n"x;y";"diz ""oi"""\r\n');
  });
  it("neutraliza fórmulas (= + - @) nas células de texto, mas não em números", () => {
    assert.equal(celula("=SOMA(A1)"), "'=SOMA(A1)");
    assert.equal(celula("+55 11 9"), "'+55 11 9");
    assert.equal(celula(-5), "-5");
  });
  it("valores em reais com vírgula decimal", () => assert.equal(reais(12345), "123,45"));
});

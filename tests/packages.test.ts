import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { consomeSessao, escolherPacote, itemCabeNoPacote, progresso, statusDaSessao, statusDoPacote, vencimento } from "../src/lib/packages/rules";
import type { PackageSessionStatus } from "../src/generated/prisma/enums";

const S = (...st: PackageSessionStatus[]) => st.map((status) => ({ status }));
const DIA = 86_400_000;

describe("itemCabeNoPacote", () => {
  it("exige o mesmo cliente; serviço específico > categoria > livre", () => {
    const item = { clientId: "c1", serviceId: "s1", categoryId: "k1" };
    assert.equal(itemCabeNoPacote({ clientId: "c2", serviceId: null, categoryId: null }, item).ok, false);
    assert.equal(itemCabeNoPacote({ clientId: "c1", serviceId: "s1", categoryId: null }, item).ok, true);
    assert.equal(itemCabeNoPacote({ clientId: "c1", serviceId: "s2", categoryId: null }, item).ok, false);
    assert.equal(itemCabeNoPacote({ clientId: "c1", serviceId: null, categoryId: "k1" }, item).ok, true);
    assert.equal(itemCabeNoPacote({ clientId: "c1", serviceId: null, categoryId: "k2" }, item).ok, false);
    assert.equal(itemCabeNoPacote({ clientId: "c1", serviceId: null, categoryId: null }, item).ok, true);
  });
});

describe("sessão espelha a visita e consome conforme a política", () => {
  it("status da sessão", () => {
    assert.equal(statusDaSessao("COMPLETED"), "DONE");
    assert.equal(statusDaSessao("NO_SHOW"), "NO_SHOW");
    assert.equal(statusDaSessao("CANCELLED_BY_CLIENT"), "CANCELLED");
    assert.equal(statusDaSessao("CONFIRMED"), "SCHEDULED");
    assert.equal(statusDaSessao("RESCHEDULE_REQUESTED"), "SCHEDULED");
  });
  it("falta consome ou libera conforme o estabelecimento; cancelada nunca consome", () => {
    assert.equal(consomeSessao({ status: "NO_SHOW" }, "CONSOME"), true);
    assert.equal(consomeSessao({ status: "NO_SHOW" }, "LIBERA"), false);
    assert.equal(consomeSessao({ status: "CANCELLED" }, "CONSOME"), false);
    assert.equal(consomeSessao({ status: "SCHEDULED" }, "CONSOME"), false);
  });
});

describe("progresso e status", () => {
  const agora = new Date("2026-09-20T12:00:00Z");
  it("5 contratadas, 1 realizada, 1 agendada: 4 restantes, 3 disponíveis", () => {
    const p = progresso({ status: "ACTIVE", sessionsTotal: 5, expiresAt: null }, S("DONE", "SCHEDULED", "CANCELLED"), "CONSOME", agora);
    assert.deepEqual([p.usadas, p.agendadas, p.restantes, p.disponiveis, p.podeAgendar], [1, 1, 4, 3, true]);
  });
  it("vale até o fim do dia do vencimento", () => {
    const venc = new Date("2026-09-20T00:00:00Z");
    assert.equal(progresso({ status: "ACTIVE", sessionsTotal: 5, expiresAt: venc }, [], "CONSOME", new Date("2026-09-20T23:00:00Z")).vencido, false);
    assert.equal(progresso({ status: "ACTIVE", sessionsTotal: 5, expiresAt: venc }, [], "CONSOME", new Date("2026-09-21T00:00:00Z")).vencido, true);
  });
  it("status derivado: concluído antes de vencido; cancelado fica cancelado", () => {
    const pk = { status: "ACTIVE" as const, sessionsTotal: 2, expiresAt: new Date(agora.getTime() - 5 * DIA) };
    assert.equal(statusDoPacote(pk, progresso(pk, S("DONE", "DONE"), "CONSOME", agora)), "COMPLETED");
    assert.equal(statusDoPacote(pk, progresso(pk, S("DONE"), "CONSOME", agora)), "EXPIRED");
    assert.equal(statusDoPacote({ ...pk, status: "CANCELLED" }, progresso(pk, [], "CONSOME", agora)), "CANCELLED");
    assert.equal(statusDoPacote({ ...pk, expiresAt: null }, progresso({ ...pk, expiresAt: null }, [], "CONSOME", agora)), "ACTIVE");
  });
  it("vencimento a partir da validade", () => {
    assert.equal(vencimento(new Date("2026-09-20T00:00:00Z"), 30)?.toISOString(), "2026-10-20T00:00:00.000Z");
    assert.equal(vencimento(new Date(), null), null);
  });
});

describe("escolherPacote", () => {
  const item = { clientId: "c1", serviceId: "s1", categoryId: "k1" };
  const livre = { id: "L", clientId: "c1", serviceId: null, categoryId: null, expiresAt: null };
  const cat = { id: "K", clientId: "c1", serviceId: null, categoryId: "k1", expiresAt: new Date("2026-12-01") };
  const serv = { id: "S", clientId: "c1", serviceId: "s1", categoryId: null, expiresAt: new Date("2027-01-01") };
  it("prefere serviço > categoria > livre, só com saldo", () => {
    const disp = new Map([["L", 3], ["K", 1], ["S", 2]]);
    assert.equal(escolherPacote([livre, cat, serv], disp, item)?.id, "S");
    disp.set("S", 0);
    assert.equal(escolherPacote([livre, cat, serv], disp, item)?.id, "K");
    disp.set("K", 0);
    assert.equal(escolherPacote([livre, cat, serv], disp, item)?.id, "L");
    disp.set("L", 0);
    assert.equal(escolherPacote([livre, cat, serv], disp, item), null);
  });
  it("entre iguais, o que vence primeiro", () => {
    const a = { ...livre, id: "A", expiresAt: new Date("2026-11-01") };
    const b = { ...livre, id: "B", expiresAt: new Date("2026-10-01") };
    assert.equal(escolherPacote([a, b], new Map([["A", 1], ["B", 1]]), item)?.id, "B");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { etapaSugerida, moduloClinicoAtivo, resumoPagamentos, sugerirProximaSessao } from "../src/lib/treatments/rules";
import { escolherPacote, itemCabeNoPacote, type EscopoPacote } from "../src/lib/packages/rules";

const DIA = 86_400_000;
const agora = new Date("2026-10-17T12:00:00Z");

describe("moduloClinicoAtivo", () => {
  it("aparece para Estética e enquanto o estabelecimento ainda não escolheu segmento", () => {
    assert.equal(moduloClinicoAtivo(["estetica"]), true);
    assert.equal(moduloClinicoAtivo(["cabelo", "estetica"]), true);
    assert.equal(moduloClinicoAtivo([]), true);
  });
  it("fica oculto para quem só atende outros segmentos", () => {
    assert.equal(moduloClinicoAtivo(["cabelo", "unhas"]), false);
  });
});

describe("sugerirProximaSessao", () => {
  it("última realizada + intervalo", () => {
    const ultima = new Date(agora.getTime() - 3 * DIA);
    assert.equal(sugerirProximaSessao(15, ultima, agora).getTime(), ultima.getTime() + 15 * DIA);
  });
  it("nunca sugere o passado: intervalo já vencido → hoje", () => {
    const ultima = new Date(agora.getTime() - 40 * DIA);
    assert.equal(sugerirProximaSessao(15, ultima, agora).getTime(), agora.getTime());
  });
  it("sem intervalo ou sem sessão realizada → hoje", () => {
    assert.equal(sugerirProximaSessao(null, new Date(agora.getTime() - DIA), agora).getTime(), agora.getTime());
    assert.equal(sugerirProximaSessao(15, null, agora).getTime(), agora.getTime());
    assert.equal(sugerirProximaSessao(0, new Date(agora.getTime() - DIA), agora).getTime(), agora.getTime());
  });
});

describe("resumoPagamentos", () => {
  it("pago, saldo e quitação", () => {
    const r = resumoPagamentos(45000, [{ amountCents: 20000 }, { amountCents: 10000 }]);
    assert.deepEqual(r, { pagoCents: 30000, saldoCents: 15000, excedenteCents: 0, quitado: false });
    assert.equal(resumoPagamentos(45000, [{ amountCents: 45000 }]).quitado, true);
  });
  it("sem recebimentos: saldo = valor inteiro", () => {
    assert.deepEqual(resumoPagamentos(45000, []), { pagoCents: 0, saldoCents: 45000, excedenteCents: 0, quitado: false });
  });
  it("recebido a mais (preço reduzido depois) vira excedente, não saldo negativo", () => {
    const r = resumoPagamentos(40000, [{ amountCents: 45000 }]);
    assert.equal(r.saldoCents, 0);
    assert.equal(r.excedenteCents, 5000);
    assert.equal(r.quitado, true);
  });
  it("plano de valor zero nunca conta como quitado (cortesia não é pagamento)", () => {
    assert.equal(resumoPagamentos(0, []).quitado, false);
  });
});

describe("etapaSugerida", () => {
  const etapas = ["limpeza", "esfoliação", "máscara"];
  it("a sessão N sugere a etapa N e cicla", () => {
    assert.equal(etapaSugerida(etapas, 0), "limpeza");
    assert.equal(etapaSugerida(etapas, 2), "máscara");
    assert.equal(etapaSugerida(etapas, 3), "limpeza");
  });
  it("protocolo sem etapas → null", () => assert.equal(etapaSugerida([], 5), null));
});

describe("escopo por protocolo (itemCabeNoPacote / escolherPacote)", () => {
  const cliente = "c1";
  const protocolo: EscopoPacote = { clientId: cliente, serviceId: null, categoryId: null, protocolServiceIds: ["limpeza", "peeling", "mascara"] };

  it("qualquer etapa do protocolo cabe, na ordem que for (repetir uma limpeza é permitido)", () => {
    for (const serviceId of ["limpeza", "peeling", "mascara"]) {
      assert.deepEqual(itemCabeNoPacote(protocolo, { clientId: cliente, serviceId, categoryId: "x" }), { ok: true });
    }
  });
  it("serviço fora do protocolo não cabe (a limpeza do pacote não vira massagem)", () => {
    const r = itemCabeNoPacote(protocolo, { clientId: cliente, serviceId: "massagem", categoryId: "x" });
    assert.equal(r.ok, false);
  });
  it("outro cliente nunca cabe", () => {
    assert.equal(itemCabeNoPacote(protocolo, { clientId: "c2", serviceId: "limpeza", categoryId: null }).ok, false);
  });
  it("protocolo sem etapas cadastradas não vira 'vale tudo': cai na regra de categoria", () => {
    const vazio: EscopoPacote = { clientId: cliente, serviceId: null, categoryId: "estetica", protocolServiceIds: [] };
    assert.equal(itemCabeNoPacote(vazio, { clientId: cliente, serviceId: "qualquer", categoryId: "cabelo" }).ok, false);
    assert.equal(itemCabeNoPacote(vazio, { clientId: cliente, serviceId: "limpeza", categoryId: "estetica" }).ok, true);
  });
  it("pacote de um serviço continua estrito mesmo com protocolo informado", () => {
    const misto: EscopoPacote = { clientId: cliente, serviceId: "limpeza", categoryId: null, protocolServiceIds: ["limpeza", "peeling"] };
    assert.equal(itemCabeNoPacote(misto, { clientId: cliente, serviceId: "peeling", categoryId: null }).ok, false);
  });

  it("preferência na escolha: serviço > protocolo > categoria > livre", () => {
    type P = EscopoPacote & { id: string; expiresAt: Date | null };
    const pacotes: P[] = [
      { id: "livre", clientId: cliente, serviceId: null, categoryId: null, expiresAt: null },
      { id: "categoria", clientId: cliente, serviceId: null, categoryId: "estetica", expiresAt: null },
      { id: "protocolo", clientId: cliente, serviceId: null, categoryId: null, protocolServiceIds: ["limpeza"], expiresAt: null },
      { id: "servico", clientId: cliente, serviceId: "limpeza", categoryId: null, expiresAt: null },
    ];
    const livres = (ids: string[]) => new Map(ids.map((i) => [i, 1]));
    const item = { clientId: cliente, serviceId: "limpeza", categoryId: "estetica" };
    assert.equal(escolherPacote(pacotes, livres(["livre", "categoria", "protocolo", "servico"]), item)?.id, "servico");
    assert.equal(escolherPacote(pacotes, livres(["livre", "categoria", "protocolo"]), item)?.id, "protocolo");
    assert.equal(escolherPacote(pacotes, livres(["livre", "categoria"]), item)?.id, "categoria");
    assert.equal(escolherPacote(pacotes, livres(["livre"]), item)?.id, "livre");
  });
});

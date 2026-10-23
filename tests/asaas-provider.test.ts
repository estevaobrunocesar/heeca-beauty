import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { AsaasPixProvider } from "../src/lib/payments/providers/asaas";

// Servidor Asaas simulado: valida o fluxo HTTP do provedor (cliente → cobrança → QR → status → estorno → cancelamento).
// Não prova o contrato real do Asaas; isso só um teste no sandbox com uma chave de verdade prova.

type Req = { method: string; url: string; headers: IncomingMessage["headers"]; body: Record<string, unknown> | null };
let server: Server;
let base = "";
const calls: Req[] = [];
const customers: { id: string; externalReference: string }[] = [];
const payments = new Map<string, { status: string; deleted?: boolean }>();

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      calls.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers, body });
      const json = (status: number, data: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
      if (req.headers.access_token !== "chave-valida-0123456789") return json(401, { errors: [{ code: "invalid_access_token", description: "A chave de API informada é inválida" }] });
      const url = new URL(req.url ?? "/", "http://x");
      if (req.method === "GET" && url.pathname === "/customers") {
        const ref = url.searchParams.get("externalReference");
        return json(200, { data: customers.filter((c) => !ref || c.externalReference === ref) });
      }
      if (req.method === "POST" && url.pathname === "/customers") {
        if (!body?.cpfCnpj) return json(400, { errors: [{ code: "invalid_object", description: "cpfCnpj obrigatório" }] });
        const c = { id: `cus_${customers.length + 1}`, externalReference: String(body.externalReference) };
        customers.push(c);
        return json(200, c);
      }
      if (req.method === "POST" && url.pathname === "/payments") {
        const id = `pay_${payments.size + 1}`;
        payments.set(id, { status: "PENDING" });
        return json(200, { id, status: "PENDING" });
      }
      const m = url.pathname.match(/^\/payments\/([^/]+)(\/.*)?$/);
      if (m) {
        const p = payments.get(m[1]);
        if (!p) return json(404, { errors: [{ code: "not_found", description: "Cobrança não encontrada" }] });
        if (req.method === "GET" && m[2] === "/pixQrCode") return json(200, { encodedImage: "UE5H", payload: "00020126...PIX", expirationDate: "2026-10-24 23:59:59" });
        if (req.method === "GET" && !m[2]) return json(200, { id: m[1], ...p });
        if (req.method === "POST" && m[2] === "/refund") { p.status = "REFUNDED"; return json(200, { id: m[1], status: "REFUNDED" }); }
        if (req.method === "DELETE" && !m[2]) { p.deleted = true; return json(200, { deleted: true, id: m[1] }); }
      }
      return json(404, { errors: [{ code: "not_found", description: "rota" }] });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const novo = () => new AsaasPixProvider("chave-valida-0123456789", base);
const cobranca = (cpf: string | null) => ({
  amountCents: 3000, description: "Sinal · Corte", externalReference: "appt_1", expiresAt: new Date(Date.now() + 3600_000),
  payer: { id: "client_1", name: "Maria", email: null, phone: "+5511987654321", cpf },
});

describe("AsaasPixProvider (servidor simulado)", () => {
  it("chave inválida: healthCheck explica e createCharge falha", async () => {
    const ruim = new AsaasPixProvider("chave-errada", base);
    const h = await ruim.healthCheck();
    assert.equal(h.ok, false);
    if (!h.ok) assert.match(h.error, /inválida/);
  });

  it("healthCheck com chave válida", async () => assert.equal((await novo().healthCheck()).ok, true));

  it("cria o cliente (com CPF) e a cobrança Pix, e devolve QR e copia-e-cola", async () => {
    calls.length = 0;
    const r = await novo().createCharge(cobranca("52998224725"));
    assert.equal(r.providerPaymentId, "pay_1");
    assert.equal(r.copyPaste, "00020126...PIX");
    assert.equal(r.qrCodeBase64, "UE5H");
    const criou = calls.find((c) => c.method === "POST" && c.url === "/customers")!;
    assert.equal(criou.body?.cpfCnpj, "52998224725");
    assert.equal(criou.body?.externalReference, "client_1");
    assert.equal(criou.body?.notificationDisabled, true);
    assert.equal(criou.body?.mobilePhone, "11987654321");
    const pagamento = calls.find((c) => c.method === "POST" && c.url === "/payments")!;
    assert.deepEqual([pagamento.body?.billingType, pagamento.body?.value, pagamento.body?.externalReference, pagamento.body?.customer], ["PIX", 30, "appt_1", "cus_1"]);
    assert.equal(calls.every((c) => c.headers.access_token === "chave-valida-0123456789"), true, "toda chamada leva a chave");
  });

  it("reaproveita o cliente na segunda cobrança (não cria de novo)", async () => {
    calls.length = 0;
    await novo().createCharge(cobranca("52998224725"));
    assert.equal(calls.some((c) => c.method === "POST" && c.url === "/customers"), false);
    assert.equal(customers.length, 1);
  });

  it("cliente novo sem CPF: recusa antes de chamar o Asaas para cobrar", async () => {
    await assert.rejects(() => novo().createCharge({ ...cobranca(null), payer: { ...cobranca(null).payer, id: "client_2" } }), /CPF/);
  });

  it("status: pendente → pago → estornado, e cancelada", async () => {
    const p = novo();
    assert.equal(await p.getStatus("pay_1"), "pending");
    payments.get("pay_1")!.status = "RECEIVED";
    assert.equal(await p.getStatus("pay_1"), "paid");
    await p.refund("pay_1", 3000);
    assert.equal(await p.getStatus("pay_1"), "refunded");
    await p.cancel("pay_2");
    assert.equal(await p.getStatus("pay_2"), "cancelled");
  });

  it("erro da API vira mensagem em português do Asaas", async () => {
    await assert.rejects(() => novo().getStatus("pay_inexistente"), /Cobrança não encontrada/);
  });
});

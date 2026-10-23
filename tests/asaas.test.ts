import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidCpf, onlyCpfDigits, formatCpf } from "../src/lib/cpf";
import {
  asaasBaseUrl, asaasMobile, buildPixPaymentBody, cleanApiKey, paymentIdFromWebhook, statusFromAsaas, toAsaasDate, toAsaasValue, verifyWebhookToken,
} from "../src/lib/payments/asaas-rules";

describe("cpf", () => {
  it("aceita CPF válido com ou sem máscara", () => {
    assert.equal(isValidCpf("529.982.247-25"), true);
    assert.equal(isValidCpf("52998224725"), true);
  });
  it("recusa dígito verificador errado, sequências repetidas e tamanho errado", () => {
    assert.equal(isValidCpf("529.982.247-24"), false);
    assert.equal(isValidCpf("111.111.111-11"), false);
    assert.equal(isValidCpf("1234"), false);
    assert.equal(isValidCpf(""), false);
    assert.equal(isValidCpf(null), false);
  });
  it("só dígitos e máscara", () => {
    assert.equal(onlyCpfDigits("529.982.247-25"), "52998224725");
    assert.equal(onlyCpfDigits("123"), null);
    assert.equal(formatCpf("52998224725"), "529.982.247-25");
  });
});

describe("asaas: ambiente e formatos", () => {
  it("sandbox por padrão; produção só com ASAAS_ENV=production; URL manual sobrescreve", () => {
    assert.equal(asaasBaseUrl(undefined), "https://api-sandbox.asaas.com/v3");
    assert.equal(asaasBaseUrl("production"), "https://api.asaas.com/v3");
    assert.equal(asaasBaseUrl("production", "http://localhost:9/"), "http://localhost:9");
  });
  it("valor em reais com 2 casas", () => assert.equal(toAsaasValue(2050), 20.5));
  it("vencimento nunca no passado", () => {
    const agora = new Date("2026-10-23T15:00:00Z");
    assert.equal(toAsaasDate(new Date("2026-10-23T18:00:00Z"), agora), "2026-10-23");
    assert.equal(toAsaasDate(new Date("2026-10-20T00:00:00Z"), agora), "2026-10-23");
  });
  it("celular nacional a partir do E.164", () => {
    assert.equal(asaasMobile("+5511987654321"), "11987654321");
    assert.equal(asaasMobile("+551133334444"), "1133334444");
    assert.equal(asaasMobile("123"), null);
    assert.equal(asaasMobile(null), null);
  });
  it("chave de API: sem espaços e com tamanho plausível", () => {
    assert.equal(cleanApiKey("  $aact_prod_000000000000000000000000  ")?.startsWith("$aact"), true);
    assert.equal(cleanApiKey("curta"), null);
    assert.equal(cleanApiKey("com espaco no meio 123456789012345"), null);
  });
});

describe("asaas: cobrança e status", () => {
  it("corpo do Pix do sinal", () => {
    const b = buildPixPaymentBody({ customerId: "cus_1", amountCents: 3000, expiresAt: new Date("2026-10-24T12:00:00Z"), description: "Sinal", externalReference: "appt_1" }, new Date("2026-10-23T12:00:00Z"));
    assert.deepEqual(b, { customer: "cus_1", billingType: "PIX", value: 30, dueDate: "2026-10-24", description: "Sinal", externalReference: "appt_1" });
  });
  it("status do Asaas para o do provedor", () => {
    assert.equal(statusFromAsaas({ status: "RECEIVED" }), "paid");
    assert.equal(statusFromAsaas({ status: "CONFIRMED" }), "paid");
    assert.equal(statusFromAsaas({ status: "PENDING" }), "pending");
    assert.equal(statusFromAsaas({ status: "OVERDUE" }), "expired");
    assert.equal(statusFromAsaas({ status: "REFUNDED" }), "refunded");
    assert.equal(statusFromAsaas({ status: "PENDING", deleted: true }), "cancelled");
  });
});

describe("asaas: webhook", () => {
  it("token confere só quando igual", () => {
    assert.equal(verifyWebhookToken("abc", "abc"), true);
    assert.equal(verifyWebhookToken("abd", "abc"), false);
    assert.equal(verifyWebhookToken("abcd", "abc"), false);
    assert.equal(verifyWebhookToken(null, "abc"), false);
    assert.equal(verifyWebhookToken("abc", null), false);
    assert.equal(verifyWebhookToken("", ""), false);
  });
  it("só eventos úteis devolvem o id da cobrança", () => {
    assert.equal(paymentIdFromWebhook({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } }), "pay_1");
    assert.equal(paymentIdFromWebhook({ event: "PAYMENT_CREATED", payment: { id: "pay_1" } }), null);
    assert.equal(paymentIdFromWebhook({ event: "PAYMENT_RECEIVED" }), null);
    assert.equal(paymentIdFromWebhook(null), null);
  });
});

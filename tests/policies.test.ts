import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canClientCancel, computeExpiresAt } from "../src/lib/appointments/policies";

const H = 3_600_000;
const M = 60_000;
const now = new Date("2026-09-21T12:00:00Z");
const tenant = { pendingExpiryMinutes: 120, cancelDeadlineHours: 2, requireWhatsappConfirmation: true };

describe("computeExpiresAt", () => {
  it("nunca expira sem confirmação via WhatsApp ou sem prazo configurado", () => {
    assert.equal(computeExpiresAt({ ...tenant, requireWhatsappConfirmation: false }, new Date(now.getTime() + 24 * H), now), null);
    assert.equal(computeExpiresAt({ ...tenant, pendingExpiryMinutes: null }, new Date(now.getTime() + 24 * H), now), null);
  });

  it("usa o prazo configurado quando o atendimento está longe", () => {
    const r = computeExpiresAt(tenant, new Date(now.getTime() + 24 * H), now);
    assert.equal(r?.getTime(), now.getTime() + 120 * M);
  });

  it("antecipa para 30 min antes do atendimento quando o prazo passaria dele", () => {
    const startsAt = new Date(now.getTime() + 90 * M);
    assert.equal(computeExpiresAt(tenant, startsAt, now)?.getTime(), startsAt.getTime() - 30 * M);
  });

  it("não expira quando agendado em cima da hora (menos de 30 min)", () => {
    assert.equal(computeExpiresAt(tenant, new Date(now.getTime() + 20 * M), now), null);
  });
});

describe("canClientCancel", () => {
  const future = new Date(now.getTime() + 24 * H);

  it("nega status finais e horários passados", () => {
    for (const status of ["COMPLETED", "NO_SHOW", "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROFESSIONAL"] as const) {
      assert.equal(canClientCancel(tenant, { status, startsAt: future }, now).ok, false);
    }
    assert.equal(canClientCancel(tenant, { status: "CONFIRMED", startsAt: new Date(now.getTime() - M) }, now).ok, false);
  });

  it("pendentes podem cancelar a qualquer momento, mesmo dentro do prazo", () => {
    const soon = new Date(now.getTime() + 30 * M);
    assert.equal(canClientCancel(tenant, { status: "PENDING", startsAt: soon }, now).ok, true);
    assert.equal(canClientCancel(tenant, { status: "AWAITING_CONFIRMATION", startsAt: soon }, now).ok, true);
  });

  it("confirmados respeitam o prazo de antecedência", () => {
    assert.equal(canClientCancel(tenant, { status: "CONFIRMED", startsAt: new Date(now.getTime() + 3 * H) }, now).ok, true);
    assert.equal(canClientCancel(tenant, { status: "CONFIRMED", startsAt: new Date(now.getTime() + 2 * H) }, now).ok, true, "exatamente no limite ainda pode");
    const late = canClientCancel(tenant, { status: "CONFIRMED", startsAt: new Date(now.getTime() + H) }, now);
    assert.equal(late.ok, false);
    assert.match(!late.ok ? late.reason : "", /2 horas/);
  });

  it("prazo 0 = a qualquer momento antes do início", () => {
    const t = { ...tenant, cancelDeadlineHours: 0 };
    assert.equal(canClientCancel(t, { status: "CONFIRMED", startsAt: new Date(now.getTime() + M) }, now).ok, true);
  });
});

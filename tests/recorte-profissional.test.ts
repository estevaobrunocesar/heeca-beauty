import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recorteDoProfissional } from "../src/lib/appointments/summary";

const d = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 12, h, m));
const item = (professionalId: string, serviceName: string, s: Date, e: Date, priceCents: number) => ({ professionalId, serviceName, startsAt: s, endsAt: e, priceCents });
const visita = {
  startsAt: d(10), endsAt: d(13), serviceName: "Corte + Unha + Tintura", priceCents: 30000, durationMinutes: 180,
  items: [item("ana", "Corte", d(10), d(11), 10000), item("bia", "Unha", d(10), d(11, 30), 8000), item("ana", "Tintura", d(11), d(13), 12000)],
};

describe("recorte da visita para o profissional", () => {
  it("mostra só os serviços, o horário e o valor dele; guarda o total da conta", () => {
    const r = recorteDoProfissional(visita, ["ana"]);
    assert.equal(r.serviceName, "Corte + Tintura");
    assert.equal(r.priceCents, 22000);
    assert.equal(r.totalCents, 30000);
    assert.equal(r.durationMinutes, 180);
    assert.equal(r.items.length, 2);
    assert.equal(r.recortada, true);
  });
  it("o outro profissional vê só o dele", () => {
    const r = recorteDoProfissional(visita, ["bia"]);
    assert.equal(r.serviceName, "Unha");
    assert.equal(r.priceCents, 8000);
    assert.equal(r.durationMinutes, 90);
    assert.equal(r.endsAt.getTime(), d(11, 30).getTime());
  });
  it("visita só dele, ou sem item dele, não muda", () => {
    assert.equal(recorteDoProfissional({ ...visita, items: [visita.items[0]] }, ["ana"]).recortada, false);
    assert.equal(recorteDoProfissional(visita, ["zeca"]).serviceName, visita.serviceName);
  });
});

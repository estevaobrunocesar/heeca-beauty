import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { destinoDoAviso, mensagemDoAviso, tokenValido, usuariosDoAviso } from "../src/lib/push/rules";

describe("avisos no celular da profissional", () => {
  const dados = { cliente: "Camila Ferreira", servico: "Corte + Escova", quando: "qui, 29/10 às 14:00" };

  it("novo agendamento: quem, o quê e quando", () => {
    assert.deepEqual(mensagemDoAviso("NOVO_AGENDAMENTO", dados), { titulo: "Novo agendamento", corpo: "Camila Ferreira · Corte + Escova · qui, 29/10 às 14:00" });
  });

  it("cancelamento diz quem cancelou e o horário liberado", () => {
    const m = mensagemDoAviso("CANCELAMENTO", dados);
    assert.equal(m.titulo, "Agendamento cancelado");
    assert.match(m.corpo, /Camila Ferreira cancelou Corte \+ Escova de qui, 29\/10 às 14:00/);
  });

  it("cliente sem nome vira 'Cliente'", () => {
    assert.match(mensagemDoAviso("NOVO_AGENDAMENTO", { ...dados, cliente: "  " }).corpo, /^Cliente · /);
  });

  it("destinatários: só quem tem login, sem repetir quando a visita tem vários itens da mesma pessoa", () => {
    const itens = [{ professional: { userId: "u1" } }, { professional: { userId: null } }, { professional: { userId: "u1" } }, { professional: { userId: "u2" } }];
    assert.deepEqual(usuariosDoAviso(itens), ["u1", "u2"]);
    assert.deepEqual(usuariosDoAviso([{ professional: { userId: null } }]), []);
  });

  it("ao tocar no aviso abre a agenda do dia", () => {
    assert.equal(destinoDoAviso("2026-10-29"), "/app/agenda?date=2026-10-29");
  });

  it("token do aparelho: recusa vazio, curto, com espaço e não-texto", () => {
    assert.equal(tokenValido("a".repeat(150)), true);
    for (const t of ["", "curto", "tem espaco no meio aaaaaaaaaaaa", 123, null, undefined, "x".repeat(5000)]) assert.equal(tokenValido(t), false);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MARCAS, fichaDe, segmentosDe } from "../src/lib/marca";
import { fichaBruta, fichaDoForm, lerFicha, mesclarFicha, resumoFicha } from "../src/lib/clients/ficha";

const campos = fichaDe(segmentosDe(MARCAS.beauty, { segmentos: ["unhas", "cilios"] }));

describe("ficha por segmento", () => {
  it("todo segmento declara campos com códigos únicos e rótulo", () => {
    for (const m of Object.values(MARCAS)) for (const s of m.segmentos) {
      const codigos = s.ficha.map((c) => c.codigo);
      assert.equal(new Set(codigos).size, codigos.length, s.slug);
      for (const c of s.ficha) assert.ok(c.rotulo.length > 1 && !c.codigo.includes("."), `${s.slug}.${c.codigo}`);
    }
  });
  it("lerFicha só aceita strings não vazias em códigos dos segmentos ativos", () => {
    const f = lerFicha({ "unhas.formato": " Almond ", "cilios.curvatura": "", "sobrancelhas.formato": "Reto", extra: "x", "unhas.tamanho": 3 }, campos);
    assert.deepEqual(f, { "unhas.formato": "Almond" });
    assert.deepEqual(lerFicha(null, campos), {});
    assert.deepEqual(lerFicha("texto", campos), {});
  });
  it("fichaDoForm lê ficha.<codigo>, corta espaços e ignora vazios", () => {
    const fd = new FormData();
    fd.set("ficha.unhas.formato", " Quadrado ");
    fd.set("ficha.cilios.curvatura", "");
    fd.set("ficha.cilios.efeito", "Fox");
    fd.set("outro", "ignorado");
    assert.deepEqual(fichaDoForm(fd, campos), { "unhas.formato": "Quadrado", "cilios.efeito": "Fox" });
  });
  it("registro do atendimento atualiza a ficha sem apagar campos vazios nem segmentos desligados", () => {
    const atual = fichaBruta({ "unhas.formato": "Almond", "unhas.tamanho": "Médio", "sobrancelhas.formato": "Reto" });
    assert.deepEqual(mesclarFicha(atual, { "unhas.formato": "Stiletto" }), { "unhas.formato": "Stiletto", "unhas.tamanho": "Médio", "sobrancelhas.formato": "Reto" });
  });
  it("resumo segue a ordem dos campos", () => {
    assert.equal(resumoFicha(campos, { "cilios.curvatura": "D", "unhas.formato": "Almond" }), "Formato Almond · Curvatura D");
    assert.equal(resumoFicha(campos, {}), "");
  });
});

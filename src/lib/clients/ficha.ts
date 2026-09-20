import type { CampoFicha } from "@/lib/marca";

/**
 * Ficha técnica da cliente, configurável por segmento (lib/marca.ts → `fichaDe(segmentos)`).
 * Guardada como JSON `{ [codigo]: valor }` em Client.ficha, com códigos prefixados pelo segmento
 * (`unhas.formato`); o registro de cada atendimento (Appointment.registro) usa os mesmos códigos.
 * Funções puras.
 */
export type Ficha = Record<string, string>;

/** Lê o JSON do banco com tolerância: só strings não vazias, só códigos conhecidos pelos segmentos ativos. */
export function lerFicha(json: unknown, campos: CampoFicha[]): Ficha {
  const out: Ficha = {};
  if (!json || typeof json !== "object") return out;
  for (const c of campos) {
    const v = (json as Record<string, unknown>)[c.codigo];
    if (typeof v === "string" && v.trim()) out[c.codigo] = v.trim();
  }
  return out;
}

/** Campos `ficha.<codigo>` de um formulário → Ficha (vazios viram ausência). */
export function fichaDoForm(formData: FormData, campos: CampoFicha[]): Ficha {
  const out: Ficha = {};
  for (const c of campos) {
    const v = String(formData.get(`ficha.${c.codigo}`) ?? "").trim().slice(0, 120);
    if (v) out[c.codigo] = v;
  }
  return out;
}

/**
 * Salvar o registro de um atendimento atualiza a ficha: o que foi feito hoje passa a ser a
 * preferência atual. Campos vazios no registro NÃO apagam o que a ficha já tinha, e valores de
 * segmentos que o estabelecimento desligou também ficam (`atual` é o JSON inteiro lido sem filtro).
 */
export function mesclarFicha(atual: Ficha, registro: Ficha): Ficha {
  return { ...atual, ...registro };
}

/** "Formato Almond · Tamanho Médio" para listas e cabeçalhos. */
export function resumoFicha(campos: CampoFicha[], ficha: Ficha): string {
  return campos.filter((c) => ficha[c.codigo]).map((c) => `${c.rotulo} ${ficha[c.codigo]}`).join(" · ");
}

/** JSON bruto do banco → Ficha sem filtrar por campos (para mesclar sem perder segmentos desligados). */
export function fichaBruta(json: unknown): Ficha {
  const out: Ficha = {};
  if (!json || typeof json !== "object") return out;
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) if (typeof v === "string" && v.trim()) out[k] = v.trim();
  return out;
}

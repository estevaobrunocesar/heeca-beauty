"use client";

import type { CampoFicha } from "@/lib/marca";

/**
 * Campos da ficha técnica (usados na ficha da cliente e no registro do atendimento).
 * Cada campo é um input livre com sugestões (datalist) — a profissional pode digitar o que quiser.
 * Com mais de um segmento ativo, os campos aparecem agrupados pelo segmento (`grupos`).
 * Os names são `ficha.<codigo>`; o servidor lê com `fichaDoForm()`.
 */
export function FichaCampos({ campos, valores, grupos, prefixoId = "ficha" }: { campos: CampoFicha[]; valores: Record<string, string>; grupos?: Record<string, string>; prefixoId?: string }) {
  const porSegmento = new Map<string, CampoFicha[]>();
  for (const c of campos) porSegmento.set(c.segmento ?? "", [...(porSegmento.get(c.segmento ?? "") ?? []), c]);
  const agrupar = porSegmento.size > 1 && grupos;
  return (
    <div className="space-y-4">
      {[...porSegmento.entries()].map(([seg, lista]) => (
        <div key={seg}>
          {agrupar && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{grupos[seg] ?? seg}</h3>}
          <div className="grid grid-cols-2 gap-3">
            {lista.map((c) => {
              const id = `${prefixoId}-${c.codigo.replace(".", "-")}`;
              return (
                <div key={c.codigo} className={c.sugestoes.length === 0 ? "col-span-2" : ""}>
                  <label className="label" htmlFor={id}>{c.rotulo}</label>
                  <input id={id} name={`ficha.${c.codigo}`} list={c.sugestoes.length ? `${id}-lista` : undefined} className="input" defaultValue={valores[c.codigo] ?? ""} placeholder={c.placeholder ?? c.sugestoes[0] ?? ""} maxLength={120} />
                  {c.sugestoes.length > 0 && <datalist id={`${id}-lista`}>{c.sugestoes.map((s) => <option key={s} value={s} />)}</datalist>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

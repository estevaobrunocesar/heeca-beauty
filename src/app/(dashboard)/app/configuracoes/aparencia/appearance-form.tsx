"use client";

import { useActionState, useState } from "react";
import { updatePageColorAction } from "@/actions/settings";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { CORES_PRONTAS, ajustarCor, corDaPagina, normalizarHex, paletaDeCor } from "@/lib/cor-pagina";

/** Cor da página de agendamento: cores prontas, cor personalizada e prévia ao vivo com o que a cliente vai ver. */
export function AppearanceForm({ initial, corDaMarca, businessName, link }: { initial: string; corDaMarca: string; businessName: string; link: string }) {
  const [state, action] = useActionState(updatePageColorAction, null);
  const [valor, setValor] = useState(initial); // "" = cor da marca

  const hex = valor ? normalizarHex(valor) : null;
  const invalida = !!valor && !hex;
  const ajuste = hex ? ajustarCor(hex) : null;
  const efetiva = corDaPagina(ajuste?.cor ?? null, corDaMarca);
  const vars = paletaDeCor(efetiva) as React.CSSProperties;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <form action={action} className="card space-y-5 p-6">
        {state?.ok && <Alert kind="success">{state.message}</Alert>}
        {state && !state.ok && <Alert>{state.error}</Alert>}

        <div>
          <h2 className="font-medium">Cor da página de agendamento</h2>
          <p className="mt-1 text-sm text-zinc-500">É a cor que sua cliente vê no topo, nos botões e nos destaques da página. O painel continua com o padrão Heeca.</p>
        </div>

        <input type="hidden" name="pageColor" value={valor} />

        <div>
          <span className="label">Cores prontas</span>
          <div className="flex flex-wrap gap-2">
            {CORES_PRONTAS.map((c) => {
              const on = hex === c.cor;
              return (
                <button key={c.cor} type="button" onClick={() => setValor(c.cor)} aria-pressed={on} title={c.nome}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${on ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"}`}>
                  <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c.cor }} />
                  {c.nome}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cor-personalizada">Cor personalizada</label>
          <div className="flex items-center gap-3">
            <input type="color" aria-label="Escolher cor" value={hex ?? corDaMarca} onChange={(e) => setValor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-zinc-300 bg-white p-1" />
            <input id="cor-personalizada" className="input w-36 font-mono" placeholder="#7a1f3d" value={valor} onChange={(e) => setValor(e.target.value)} maxLength={7} aria-invalid={invalida} />
            <button type="button" className="btn-ghost" onClick={() => setValor("")} disabled={!valor}>Usar a cor da marca</button>
          </div>
          {invalida && <p role="alert" className="mt-1 text-xs text-rose-600">Cor inválida. Use o formato #RRGGBB, por exemplo #7a1f3d.</p>}
          {ajuste?.ajustada && <p className="mt-1 text-xs text-amber-700">Essa cor é clara demais para o texto branco. Vamos usar <strong>{ajuste.cor}</strong>, um pouco mais escura, para tudo ficar legível.</p>}
        </div>

        <div className="flex items-center gap-3">
          <SubmitButton disabled={invalida}>Salvar cor</SubmitButton>
          <a href={link} target="_blank" rel="noreferrer" className="text-sm text-zinc-600 underline">Ver minha página</a>
        </div>
      </form>

      {/* Prévia: as mesmas classes da página pública, com a paleta calculada aqui. */}
      <aside className="card h-fit overflow-hidden p-0" style={vars}>
        <div className="border-b border-zinc-100 px-5 py-3 text-sm font-medium">Como a cliente vê</div>
        <div className="relative overflow-hidden bg-brand-950 px-5 pb-8 pt-7 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_10%,var(--color-brand-700),transparent_70%)]" />
          <p className="relative text-[11px] uppercase tracking-[0.22em] text-brand-200">Agendamento online</p>
          <p className="relative mt-2 text-3xl font-semibold leading-tight">{businessName}</p>
          <span className="relative mt-5 inline-block rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-900">Agendar meu horário</span>
        </div>
        <div className="space-y-3 bg-white px-5 py-5">
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
            <p className="font-medium text-brand-950">Categoria de serviços</p>
            <p className="mt-1 text-sm text-brand-700">a partir de R$ 70,00 →</p>
          </div>
          <span className="inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">Continuar</span>
        </div>
      </aside>
    </div>
  );
}

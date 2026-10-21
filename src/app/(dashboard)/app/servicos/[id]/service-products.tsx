"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveServiceProductsAction } from "@/actions/stock";
import { Alert } from "@/components/ui/alert";

type Option = { id: string; name: string; unit: string };
type Line = { productId: string; quantity: string };

/** Quanto de cada produto um atendimento deste serviço consome. Ao concluir o atendimento o estoque baixa sozinho. */
export function ServiceProducts({ serviceId, options, initial }: { serviceId: string; options: Option[]; initial: { productId: string; quantity: number }[] }) {
  const [lines, setLines] = useState<Line[]>(initial.map((i) => ({ productId: i.productId, quantity: String(i.quantity) })));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const unit = (id: string) => options.find((o) => o.id === id)?.unit ?? "";
  const set = (i: number, patch: Partial<Line>) => setLines((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const salvar = () => {
    setMsg(null);
    start(async () => {
      const r = await saveServiceProductsAction(serviceId, lines);
      if (r) setMsg(r.ok ? { ok: true, text: r.message ?? "Salvo." } : { ok: false, text: r.error });
    });
  };

  return (
    <section className="card mt-6 space-y-3 p-5">
      <div>
        <h2 className="font-medium">Produtos usados por atendimento</h2>
        <p className="text-sm text-zinc-500">Ao concluir um atendimento deste serviço, o estoque baixa esta quantidade de cada produto.</p>
      </div>
      {options.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum produto cadastrado. <Link href="/app/estoque" className="text-brand-700 hover:underline">Cadastre em Estoque</Link> para ligar ao serviço.</p>
      ) : (
        <>
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <select className="input flex-1" value={l.productId} onChange={(e) => set(i, { productId: e.target.value })} aria-label="Produto">
                <option value="">Escolha o produto…</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <input className="input w-24" inputMode="numeric" placeholder="Qtd." value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} aria-label="Quantidade por atendimento" />
              <span className="w-8 text-xs text-zinc-500">{unit(l.productId)}</span>
              <button type="button" className="btn-ghost px-2 py-1 text-rose-600" aria-label="Remover produto" onClick={() => setLines((x) => x.filter((_, k) => k !== i))}>×</button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => setLines((x) => [...x, { productId: "", quantity: "" }])}>+ Adicionar produto</button>
            <button type="button" className="btn-primary" disabled={pending} onClick={salvar}>{pending ? "Salvando..." : "Salvar produtos"}</button>
          </div>
          {msg && <Alert kind={msg.ok ? "success" : "error"}>{msg.text}</Alert>}
        </>
      )}
    </section>
  );
}

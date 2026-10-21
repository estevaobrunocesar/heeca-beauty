"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { createProductAction, moveStockAction, toggleProductAction, updateProductAction } from "@/actions/stock";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { formatCents } from "@/lib/money";
import { UNITS, type Situacao, type Unit } from "@/lib/stock/rules";

export type ProductRow = {
  id: string; name: string; unit: Unit; costCents: number | null; minQuantity: number; notes: string | null;
  active: boolean; saldo: number; situacao: Situacao; usadoEm: number;
};

const SITUACAO: Record<Situacao, { texto: string; classe: string }> = {
  ok: { texto: "Em dia", classe: "tag-ok" },
  baixo: { texto: "Baixo", classe: "tag-warn" },
  zerado: { texto: "Zerado", classe: "tag-bad" },
  negativo: { texto: "Negativo", classe: "tag-bad" },
};
const reaisCampo = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const num = (n: number) => n.toLocaleString("pt-BR");

/** Cadastro + lista de produtos. Dono e gerente: lançar entrada/saída/contagem, editar e desativar. */
export function ProductsManager({ products }: { products: ProductRow[] }) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await createProductAction(prev, fd);
    if (r?.ok) setAberto(false);
    return r;
  }, null);

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div>
          <h2 className="font-medium">Produtos <span className="font-normal text-zinc-400">({products.length})</span></h2>
          <p className="text-xs text-zinc-500">O saldo é a soma dos lançamentos. Concluir um atendimento baixa sozinho o que o serviço usa.</p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={() => setAberto((v) => !v)}>{aberto ? "Fechar" : "+ Novo produto"}</button>
      </div>

      {aberto && (
        <form action={formAction} className="grid gap-2 border-b border-zinc-100 bg-zinc-50/60 px-4 py-3 sm:grid-cols-6">
          <div className="sm:col-span-3"><label className="label" htmlFor="p-name">Nome</label><input id="p-name" name="name" required maxLength={80} className="input" placeholder="Ex.: Tinta 7.1, Esmalte nude, Luva" autoFocus /></div>
          <div className="sm:col-span-1"><label className="label" htmlFor="p-unit">Unidade</label>
            <select id="p-unit" name="unit" className="input" defaultValue="un">{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
          <div className="sm:col-span-1"><label className="label" htmlFor="p-initial">Em estoque agora</label><input id="p-initial" name="initial" inputMode="numeric" className="input" placeholder="0" /></div>
          <div className="sm:col-span-1"><label className="label" htmlFor="p-min">Avisar quando ≤</label><input id="p-min" name="minQuantity" inputMode="numeric" className="input" placeholder="0" title="Estoque mínimo: abaixo ou igual a isso o produto aparece como baixo" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="p-cost">Custo por unidade (R$)</label><input id="p-cost" name="cost" inputMode="decimal" className="input" placeholder="0,00" /></div>
          <div className="sm:col-span-4"><label className="label" htmlFor="p-notes">Observação</label><input id="p-notes" name="notes" maxLength={300} className="input" placeholder="Marca, fornecedor… (opcional)" /></div>
          <div className="flex items-center gap-3 sm:col-span-6">
            <SubmitButton>Cadastrar produto</SubmitButton>
            {state && !state.ok && <span className="text-sm text-rose-600">{state.error}</span>}
          </div>
        </form>
      )}

      <div className="divide-y divide-zinc-100">
        {products.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-500">Nenhum produto ainda. Cadastre o primeiro em “Novo produto”.</p>}
        {products.map((p) => <ProductLine key={p.id} product={p} />)}
      </div>
    </section>
  );
}

function ProductLine({ product: p }: { product: ProductRow }) {
  const [modo, setModo] = useState<"ver" | "editar" | "lancar">("ver");
  const [pending, start] = useTransition();
  const [lancamento, lancar] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await moveStockAction(p.id, prev, fd);
    if (r?.ok) setModo("ver");
    return r;
  }, null);
  const [edicao, editar] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await updateProductAction(p.id, prev, fd);
    if (r?.ok) setModo("ver");
    return r;
  }, null);
  const [tipo, setTipo] = useState("PURCHASE");
  const s = SITUACAO[p.situacao];

  if (modo === "editar") {
    return (
      <form action={editar} className="grid gap-2 bg-zinc-50/60 px-4 py-3 sm:grid-cols-6">
        <div className="sm:col-span-3"><label className="label">Nome</label><input name="name" defaultValue={p.name} required maxLength={80} className="input" autoFocus /></div>
        <div><label className="label">Unidade</label><select name="unit" defaultValue={p.unit} className="input">{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
        <div><label className="label">Avisar quando ≤</label><input name="minQuantity" defaultValue={p.minQuantity || ""} inputMode="numeric" className="input" placeholder="0" /></div>
        <div><label className="label">Custo (R$)</label><input name="cost" defaultValue={reaisCampo(p.costCents)} inputMode="decimal" className="input" placeholder="0,00" /></div>
        <div className="sm:col-span-6"><label className="label">Observação</label><input name="notes" defaultValue={p.notes ?? ""} maxLength={300} className="input" /></div>
        <div className="flex items-center gap-2 sm:col-span-6">
          <SubmitButton>Salvar</SubmitButton>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setModo("ver")}>Cancelar</button>
          {edicao && !edicao.ok && <span className="text-xs text-rose-600">{edicao.error}</span>}
        </div>
      </form>
    );
  }

  return (
    <div className={p.active ? "" : "opacity-50"}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-44 flex-1">
          <p className="font-medium">{p.name}{!p.active && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-normal text-zinc-600">desativado</span>}</p>
          <p className="text-xs text-zinc-500">
            {p.minQuantity > 0 ? `avisa em ${num(p.minQuantity)} ${p.unit} ou menos` : "sem mínimo definido"}
            {p.costCents != null && ` · custo ${formatCents(p.costCents)}/${p.unit}`}
            {p.usadoEm > 0 && ` · usado em ${p.usadoEm} ${p.usadoEm === 1 ? "serviço" : "serviços"}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{num(p.saldo)} <span className="text-xs font-normal text-zinc-500">{p.unit}</span></p>
          <span className={`tag ${s.classe}`}>{s.texto}</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => setModo(modo === "lancar" ? "ver" : "lancar")}>Lançar</button>
          <Link href={`/app/estoque/${p.id}`} className="btn-ghost px-2 py-1 text-xs">Histórico</Link>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setModo("editar")}>Editar</button>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(async () => { await toggleProductAction(p.id); })}>{p.active ? "Desativar" : "Reativar"}</button>
        </div>
      </div>

      {modo === "lancar" && (
        <form action={lancar} className="grid gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="label">O que aconteceu</label>
            <select name="kind" className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="PURCHASE">Entrada (compra / reposição)</option>
              <option value="LOSS">Saída (perda, vencimento, uso interno)</option>
              <option value="ADJUSTMENT">Acertar contagem (inventário)</option>
            </select>
          </div>
          <div>
            <label className="label">{tipo === "ADJUSTMENT" ? `Contagem real (${p.unit})` : `Quantidade (${p.unit})`}</label>
            <input name="quantity" inputMode="numeric" required className="input" placeholder={tipo === "ADJUSTMENT" ? String(p.saldo) : "0"} autoFocus />
          </div>
          {tipo === "PURCHASE" ? <div><label className="label">Custo por {p.unit} (R$)</label><input name="cost" inputMode="decimal" className="input" placeholder="opcional" /></div> : <div className="hidden sm:block" />}
          <div className="sm:col-span-2"><label className="label">Observação</label><input name="note" maxLength={200} className="input" placeholder="Opcional" /></div>
          <div className="flex items-center gap-2 sm:col-span-6">
            <SubmitButton>Registrar</SubmitButton>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setModo("ver")}>Cancelar</button>
            {lancamento && !lancamento.ok && <Alert>{lancamento.error}</Alert>}
          </div>
        </form>
      )}
    </div>
  );
}

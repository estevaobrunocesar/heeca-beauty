"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createServiceAction, updateServiceAction } from "@/actions/services";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { categoryExamples, categoryIcon, type CategoryRef } from "@/lib/services/categories";

export type ServiceFormValues = {
  id?: string;
  name?: string;
  categoryId?: string | null;
  description?: string | null;
  clientNotes?: string | null;
  durationMinutes?: number;
  priceCents?: number;
  imageUrl?: string | null;
  isAddOn?: boolean;
  active?: boolean;
  roomRequired?: boolean;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  roomIds?: string[];
  resources?: { resourceId: string; quantity: number }[];
};

/** Salas e recursos do estabelecimento (só quando a opção "agenda por sala" está ligada). */
export type RoomOptions = { rooms: { id: string; name: string }[]; resources: { id: string; name: string; quantity: number }[] } | null;

// Durações típicas: corte 45, escova 40, manicure 45, coloração 2h, alongamento 2h30.
const DURATIONS = [10, 15, 20, 30, 40, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240];

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function ServiceForm({ initial, defaultAddOn, categories, roomOptions = null }: { initial?: ServiceFormValues; defaultAddOn?: boolean; categories: CategoryRef[]; roomOptions?: RoomOptions }) {
  const router = useRouter();
  const action = initial?.id ? updateServiceAction.bind(null, initial.id) : createServiceAction;
  const [state, formAction] = useActionState<ActionResult, FormData>(action, null);
  const [isAddOn, setIsAddOn] = useState(initial?.isAddOn ?? defaultAddOn ?? false);
  // Adicional nasce sem categoria (é listado à parte); procedimento começa na primeira categoria do salão.
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? (isAddOn ? "" : categories[0]?.id ?? ""));
  const [roomRequired, setRoomRequired] = useState(initial?.roomRequired ?? false);
  const [resourceIds, setResourceIds] = useState<Set<string>>(new Set((initial?.resources ?? []).map((r) => r.resourceId)));

  useEffect(() => {
    if (state?.ok) router.push("/app/servicos");
  }, [state, router]);

  const examples = categoryExamples(categories.find((c) => c.id === categoryId)?.slug);

  return (
    <form action={formAction} className="card max-w-xl space-y-4 p-6">
      {state && !state.ok && <Alert>{state.error}</Alert>}

      <div>
        <span className="label">Tipo</span>
        <div className="grid grid-cols-2 gap-2">
          <TypeOption
            selected={!isAddOn}
            onClick={() => { setIsAddOn(false); if (!categoryId) setCategoryId(categories[0]?.id ?? ""); }}
            title="Procedimento"
            hint="A cliente agenda sozinho (ex.: manicure, alongamento)"
          />
          <TypeOption
            selected={isAddOn}
            onClick={() => setIsAddOn(true)}
            title="Adicional"
            hint="Marcado junto com um procedimento; soma tempo e preço"
          />
        </div>
        <input type="hidden" name="isAddOn" value={isAddOn ? "on" : ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div>
          <label className="label" htmlFor="name">Nome do {isAddOn ? "adicional" : "procedimento"}</label>
          <input id="name" name="name" required className="input" defaultValue={initial?.name ?? ""} list="service-examples" placeholder={isAddOn ? "Nail art" : "Corte feminino"} />
          {examples.length > 0 && (
            <datalist id="service-examples">
              {examples.map((e) => <option key={e} value={e} />)}
            </datalist>
          )}
        </div>
        <div>
          <label className="label" htmlFor="category">Categoria</label>
          <select id="category" name="categoryId" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{categoryIcon(c.slug)} {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">Descrição <span className="font-normal text-zinc-400">(aparece na página pública)</span></label>
        <textarea id="description" name="description" rows={2} className="input" defaultValue={initial?.description ?? ""} placeholder={isAddOn ? "Desenhos delicados à mão livre em até 4 unhas." : "Alongamento resistente e natural, com formato à sua escolha."} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="durationMinutes">{isAddOn ? "Tempo a mais" : "Duração"}</label>
          <select id="durationMinutes" name="durationMinutes" className="input" defaultValue={initial?.durationMinutes ?? (isAddOn ? 15 : 60)}>
            {(isAddOn ? [0, 5, ...DURATIONS] : DURATIONS).map((d) => (
              <option key={d} value={d}>{d === 0 ? "não altera o tempo" : (isAddOn ? "+ " : "") + fmtDuration(d)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="price">{isAddOn ? "Valor a mais (R$)" : "Preço (R$)"}</label>
          <input
            id="price" name="price" required inputMode="decimal" className="input"
            defaultValue={initial?.priceCents != null ? (initial.priceCents / 100).toFixed(2).replace(".", ",") : ""}
            placeholder={isAddOn ? "25,00" : "180,00"}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="clientNotes">Observações importantes para a cliente <span className="font-normal text-zinc-400">(opcional)</span></label>
        <textarea id="clientNotes" name="clientNotes" rows={2} className="input" defaultValue={initial?.clientNotes ?? ""} placeholder="Ex.: venha sem esmalte; se tiver alongamento de outro studio, avise para incluirmos a remoção." />
        <p className="mt-1 text-xs text-zinc-500">Mostrado na página pública quando a cliente escolhe este {isAddOn ? "adicional" : "procedimento"}.</p>
      </div>

      {roomOptions && !isAddOn && (
        <fieldset className="space-y-3 rounded-xl border border-zinc-200 p-4">
          <legend className="px-1 text-sm font-medium">Sala e recursos</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="roomRequired" checked={roomRequired} onChange={(e) => setRoomRequired(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
            Precisa de uma sala livre
          </label>
          {roomRequired && (
            <div className="space-y-2 pl-6">
              <p className="text-xs text-zinc-500">Em quais salas pode acontecer? Nenhuma marcada = qualquer sala ativa, na ordem cadastrada.</p>
              <div className="flex flex-wrap gap-2">
                {roomOptions.rooms.map((r) => (
                  <label key={r.id} className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                    <input type="checkbox" name="roomIds" value={r.id} defaultChecked={initial?.roomIds?.includes(r.id)} className="h-3.5 w-3.5" />{r.name}
                  </label>
                ))}
                {roomOptions.rooms.length === 0 && <span className="text-xs text-rose-600">Nenhuma sala cadastrada — cadastre em Salas e recursos.</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="bufferBeforeMinutes">Preparo antes (min)</label>
                  <input id="bufferBeforeMinutes" name="bufferBeforeMinutes" type="number" min={0} max={120} step={5} className="input" defaultValue={initial?.bufferBeforeMinutes ?? 0} />
                </div>
                <div>
                  <label className="label" htmlFor="bufferAfterMinutes">Limpeza depois (min)</label>
                  <input id="bufferAfterMinutes" name="bufferAfterMinutes" type="number" min={0} max={120} step={5} className="input" defaultValue={initial?.bufferAfterMinutes ?? 0} />
                </div>
              </div>
              <p className="text-xs text-zinc-500">Preparo e limpeza ocupam a sala e os recursos, não o profissional.</p>
            </div>
          )}
          {roomOptions.resources.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Recursos que este serviço consome enquanto acontece:</p>
              <div className="flex flex-wrap gap-2">
                {roomOptions.resources.map((r) => {
                  const on = resourceIds.has(r.id);
                  const qtd = initial?.resources?.find((x) => x.resourceId === r.id)?.quantity ?? 1;
                  return (
                    <label key={r.id} className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                      <input type="checkbox" name="resourceIds" value={r.id} checked={on} onChange={(e) => setResourceIds((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} className="h-3.5 w-3.5" />
                      {r.name}
                      {on && r.quantity > 1 && <input name={`resourceQty.${r.id}`} type="number" min={1} max={r.quantity} defaultValue={qtd} className="ml-1 w-12 rounded border border-zinc-200 px-1 text-xs" title="Unidades" />}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </fieldset>
      )}

      <div>
        <label className="label" htmlFor="imageUrl">URL da imagem (opcional)</label>
        <input id="imageUrl" name="imageUrl" type="url" className="input" defaultValue={initial?.imageUrl ?? ""} placeholder="https://..." />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="h-4 w-4 rounded border-zinc-300" />
        Ativo (visível na página pública)
      </label>

      <div className="flex gap-2 pt-2">
        <SubmitButton>{initial?.id ? "Salvar alterações" : isAddOn ? "Criar adicional" : "Criar procedimento"}</SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancelar</button>
      </div>
    </form>
  );
}

function TypeOption({ selected, onClick, title, hint }: { selected: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition ${selected ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200" : "border-zinc-200 hover:border-zinc-400"}`}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-zinc-500">{hint}</p>
    </button>
  );
}

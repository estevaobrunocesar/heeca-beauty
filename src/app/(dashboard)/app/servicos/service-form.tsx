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
};

// Durações típicas: corte 45, escova 40, manicure 45, coloração 2h, alongamento 2h30.
const DURATIONS = [10, 15, 20, 30, 40, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240];

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function ServiceForm({ initial, defaultAddOn, categories }: { initial?: ServiceFormValues; defaultAddOn?: boolean; categories: CategoryRef[] }) {
  const router = useRouter();
  const action = initial?.id ? updateServiceAction.bind(null, initial.id) : createServiceAction;
  const [state, formAction] = useActionState<ActionResult, FormData>(action, null);
  const [isAddOn, setIsAddOn] = useState(initial?.isAddOn ?? defaultAddOn ?? false);
  // Adicional nasce sem categoria (é listado à parte); procedimento começa na primeira categoria do salão.
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? (isAddOn ? "" : categories[0]?.id ?? ""));

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

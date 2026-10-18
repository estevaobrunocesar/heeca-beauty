"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortfolioItemAction, updatePortfolioItemAction } from "@/actions/portfolio";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { ImageField } from "@/components/ui/image-field";
import type { ActionResult } from "@/lib/action-result";
import { categoryIcon, type CategoryRef } from "@/lib/services/categories";

export type PortfolioFormValues = {
  id?: string; imageUrl?: string; title?: string; description?: string | null; categoryId?: string | null; visible?: boolean;
};

export function PortfolioItemForm({ initial, categories }: { initial?: PortfolioFormValues; categories: CategoryRef[] }) {
  const router = useRouter();
  const action = initial?.id ? updatePortfolioItemAction.bind(null, initial.id) : createPortfolioItemAction;
  const [state, formAction] = useActionState<ActionResult, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) router.push("/app/portfolio");
  }, [state, router]);

  return (
    <form action={formAction} className="card max-w-2xl p-6">
      <div className="space-y-4">
        {state && !state.ok && <Alert>{state.error}</Alert>}
        <ImageField name="imageUrl" kind="portfolio" shape="wide" required label="Foto do trabalho" defaultValue={initial?.imageUrl} hint="JPG, PNG, WebP ou HEIC, até 8 MB. A foto é ajustada e guardada no seu espaço no Heeca." />
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div>
            <label className="label" htmlFor="title">Nome do trabalho</label>
            <input id="title" name="title" required className="input" defaultValue={initial?.title ?? ""} placeholder="Mechas loiras com corte em camadas" />
          </div>
          <div>
            <label className="label" htmlFor="category">Categoria</label>
            <select id="category" name="categoryId" className="input" defaultValue={initial?.categoryId ?? ""}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{categoryIcon(c.slug)} {c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="description">Descrição <span className="font-normal text-zinc-400">(opcional)</span></label>
          <textarea id="description" name="description" rows={2} className="input" defaultValue={initial?.description ?? ""} placeholder="Fibra de vidro, formato almond, esmaltação nude com francesinha fina." />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="visible" defaultChecked={initial?.visible ?? true} className="h-4 w-4 rounded border-zinc-300" />
          Visível na página pública
        </label>
        <div className="flex gap-2 pt-2">
          <SubmitButton>{initial?.id ? "Salvar" : "Publicar"}</SubmitButton>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancelar</button>
        </div>
      </div>
    </form>
  );
}

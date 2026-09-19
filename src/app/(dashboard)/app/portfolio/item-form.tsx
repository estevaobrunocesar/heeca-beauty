"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortfolioItemAction, updatePortfolioItemAction } from "@/actions/portfolio";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import type { ServiceCategory } from "@/generated/prisma/enums";
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/services/categories";

export type PortfolioFormValues = {
  id?: string; imageUrl?: string; title?: string; description?: string | null; category?: ServiceCategory | null; visible?: boolean;
};

export function PortfolioItemForm({ initial }: { initial?: PortfolioFormValues }) {
  const router = useRouter();
  const action = initial?.id ? updatePortfolioItemAction.bind(null, initial.id) : createPortfolioItemAction;
  const [state, formAction] = useActionState<ActionResult, FormData>(action, null);
  const [preview, setPreview] = useState(initial?.imageUrl ?? "");

  useEffect(() => {
    if (state?.ok) router.push("/app/portfolio");
  }, [state, router]);

  return (
    <form action={formAction} className="card grid max-w-3xl gap-6 p-6 sm:grid-cols-[220px_1fr]">
      <div className="aspect-square overflow-hidden rounded-xl bg-zinc-100">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" onError={() => setPreview("")} />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">💅</div>
        )}
      </div>
      <div className="space-y-4">
        {state && !state.ok && <Alert>{state.error}</Alert>}
        <div>
          <label className="label" htmlFor="imageUrl">URL da foto</label>
          <input id="imageUrl" name="imageUrl" type="url" required className="input" defaultValue={initial?.imageUrl ?? ""} placeholder="https://..." onChange={(e) => setPreview(e.target.value)} />
          <p className="mt-1 text-xs text-zinc-500">Cole o link de uma imagem (ex.: Google Drive, Imgur ou do próprio Instagram). Upload direto chega em breve.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div>
            <label className="label" htmlFor="title">Nome do procedimento</label>
            <input id="title" name="title" required className="input" defaultValue={initial?.title ?? ""} placeholder="Alongamento almond em fibra" />
          </div>
          <div>
            <label className="label" htmlFor="category">Categoria</label>
            <select id="category" name="category" className="input" defaultValue={initial?.category ?? ""}>
              <option value="">—</option>
              {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
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

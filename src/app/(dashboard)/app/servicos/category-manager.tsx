"use client";

import { useActionState, useState, useTransition } from "react";
import { createCategoryAction, deleteCategoryAction, moveCategoryAction, renameCategoryAction } from "@/actions/categories";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { categoryIcon, type CategoryRef } from "@/lib/services/categories";

/** Gerência das categorias do salão (SPEC §7): lista ordenável + criar + renomear inline + excluir. */
export function CategoryManager({ categories, counts }: { categories: CategoryRef[]; counts: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult, FormData>(createCategoryAction, null);

  return (
    <details className="card" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-zinc-700">
        Categorias <span className="font-normal text-zinc-400">({categories.length})</span>
      </summary>
      <div className="divide-y divide-zinc-100 border-t border-zinc-100">
        {categories.map((c, i) => (
          <CategoryRow key={c.id} category={c} count={counts[c.id] ?? 0} isFirst={i === 0} isLast={i === categories.length - 1} />
        ))}
        <form action={formAction} className="flex flex-wrap items-center gap-2 px-4 py-3">
          <input name="name" required maxLength={40} className="input max-w-xs" placeholder="Nova categoria (ex.: Maquiagem)" />
          <SubmitButton>Adicionar</SubmitButton>
          {state && !state.ok && <Alert>{state.error}</Alert>}
        </form>
      </div>
    </details>
  );
}

function CategoryRow({ category, count, isFirst, isLast }: { category: CategoryRef; count: number; isFirst: boolean; isLast: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (prev, fd) => { const r = await renameCategoryAction(category.id, prev, fd); if (r?.ok) setEditing(false); return r; },
    null,
  );
  const iconBtn = "rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30";

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <span className="w-6 text-center">{categoryIcon(category.slug)}</span>
      {editing ? (
        <form action={formAction} className="flex flex-1 items-center gap-2">
          <input name="name" defaultValue={category.name} required maxLength={40} className="input max-w-xs" autoFocus />
          <SubmitButton>Salvar</SubmitButton>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(false)}>Cancelar</button>
          {state && !state.ok && <span className="text-xs text-rose-600">{state.error}</span>}
        </form>
      ) : (
        <>
          <span className="flex-1 text-sm">
            {category.name} <span className="text-xs text-zinc-400">· {count} {count === 1 ? "serviço" : "serviços"}</span>
          </span>
          <button className={iconBtn} disabled={pending || isFirst} title="Subir" onClick={() => start(() => moveCategoryAction(category.id, "up"))}>↑</button>
          <button className={iconBtn} disabled={pending || isLast} title="Descer" onClick={() => start(() => moveCategoryAction(category.id, "down"))}>↓</button>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(true)}>Renomear</button>
          <button
            className="btn-ghost px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
            disabled={pending}
            onClick={() => {
              const msg = count > 0 ? `Excluir "${category.name}"? Os ${count} serviços ficam sem categoria.` : `Excluir "${category.name}"?`;
              if (confirm(msg)) start(() => deleteCategoryAction(category.id));
            }}
          >
            Excluir
          </button>
        </>
      )}
    </div>
  );
}

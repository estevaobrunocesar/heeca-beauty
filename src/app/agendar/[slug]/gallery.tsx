"use client";

import { useEffect, useState } from "react";

type Item = { id: string; imageUrl: string; title: string; description: string | null; category: string | null };

/** Galeria horizontal (rolagem lateral no celular) com visualização em tela cheia ao tocar. */
export function Gallery({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i == null ? i : (i + 1) % items.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i == null ? i : (i - 1 + items.length) % items.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items.length]);

  return (
    <>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative aspect-[4/5] w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-brand-100 shadow-sm ring-1 ring-black/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.imageUrl} alt={it.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6 text-left text-[11px] font-medium text-white">
              {it.title}
            </span>
          </button>
        ))}
      </div>

      {open != null && items[open] && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white" onClick={() => setOpen(null)} role="dialog" aria-modal>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{open + 1} / {items.length}</span>
            <button type="button" className="rounded-full px-3 py-1 hover:bg-white/10" onClick={() => setOpen(null)}>Fechar ✕</button>
          </div>
          <div className="flex flex-1 items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={items[open].imageUrl} alt={items[open].title} className="max-h-[75vh] max-w-full rounded-xl object-contain" />
          </div>
          <div className="px-5 pb-6 pt-3 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-xl">{items[open].title}</p>
            {items[open].category && <p className="text-xs text-brand-200">{items[open].category}</p>}
            {items[open].description && <p className="mt-1 text-sm text-zinc-300">{items[open].description}</p>}
            <div className="mt-3 flex justify-center gap-3 text-sm">
              <button type="button" className="rounded-full bg-white/10 px-4 py-1.5" onClick={() => setOpen((open - 1 + items.length) % items.length)}>‹ Anterior</button>
              <button type="button" className="rounded-full bg-white/10 px-4 py-1.5" onClick={() => setOpen((open + 1) % items.length)}>Próxima ›</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

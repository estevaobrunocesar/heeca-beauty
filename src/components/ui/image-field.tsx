"use client";

import { useRef, useState } from "react";
import { checkImageFile, imageSpecText, type ImageKind } from "@/lib/image-spec";

type Kind = ImageKind;

/** Envia o arquivo para /api/uploads e devolve a URL do bucket do produto. Nunca recebe URL do usuário. */
async function sendFile(file: File, kind: Kind): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  // Formato e tamanho são conferidos aqui para a resposta ser imediata; a rota confere de novo.
  const invalid = checkImageFile(file);
  if (invalid) return { ok: false, error: invalid };
  try {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    const r = await fetch("/api/uploads", { method: "POST", body: fd });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
    if (!j?.ok || !j.url) return { ok: false, error: j?.error ?? `Falha no envio (erro ${r.status}). Tente de novo; se continuar, avise o suporte da Heeca.` };
    return { ok: true, url: j.url };
  } catch {
    return { ok: false, error: "Falha de conexão. Tente novamente." };
  }
}

type FieldProps = {
  /** Nome do campo do formulário que recebe a URL (as actions continuam lendo uma string). */
  name: string;
  kind: Kind;
  defaultValue?: string | null;
  label: string;
  hint?: string;
  /** Formato da pré-visualização. */
  shape?: "square" | "circle" | "wide";
  required?: boolean;
};

/**
 * Campo de imagem: pré-visualização + envio do arquivo + input hidden com a URL resultante.
 * Regra da plataforma: não existe campo para colar link — só upload. Uma imagem legada (URL externa
 * herdada de antes) aparece na pré-visualização e pode ser trocada ou removida.
 */
export function ImageField({ name, kind, defaultValue, label, hint, shape = "square", required }: FieldProps) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    const r = await sendFile(file, kind);
    if (r.ok) setUrl(r.url); else setError(r.error);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const previewCls = shape === "circle" ? "h-20 w-20 rounded-full" : shape === "wide" ? "h-20 w-32 rounded-lg" : "h-20 w-20 rounded-lg";

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-start gap-4">
        <div className={`${previewCls} flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-400`}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : busy ? "…" : "sem imagem"}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
              {busy ? "Enviando…" : url ? "Trocar imagem" : "Enviar imagem"}
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" disabled={busy} aria-required={required} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
            </label>
            {url && !required && <button type="button" className="btn-ghost" onClick={() => setUrl("")}>Remover</button>}
          </div>
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
          {hint && !error && <p className="text-xs text-zinc-500">{hint}</p>}
          <p className="text-xs text-zinc-400">{imageSpecText(kind)}</p>
        </div>
      </div>
    </div>
  );
}

type ListProps = {
  name: string;
  kind: Kind;
  /** URLs já gravadas. */
  defaultValue?: string[];
  label: string;
  hint?: string;
  max?: number;
};

/**
 * Várias imagens (fotos do espaço): envia uma por vez, mostra miniaturas com remover e grava as URLs,
 * uma por linha, num único input hidden — o mesmo formato que a action já lê.
 */
export function ImageListField({ name, kind, defaultValue = [], label, hint, max = 12 }: ListProps) {
  const [urls, setUrls] = useState<string[]>(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: File[]) => {
    setBusy(true);
    setError(null);
    let next = urls;
    for (const f of files.slice(0, Math.max(0, max - urls.length))) {
      const r = await sendFile(f, kind);
      if (!r.ok) { setError(r.error); break; }
      next = [...next, r.url];
      setUrls(next);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={urls.join("\n")} />
      <div className="flex flex-wrap gap-2">
        {urls.map((u) => (
          <div key={u} className="relative h-20 w-28 overflow-hidden rounded-lg border border-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button type="button" aria-label="Remover foto" onClick={() => setUrls((l) => l.filter((x) => x !== u))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-xs text-rose-600 shadow">×</button>
          </div>
        ))}
        {urls.length < max && (
          <label className={`flex h-20 w-28 cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-center text-xs text-zinc-500 hover:bg-zinc-100 ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? "Enviando…" : "+ Adicionar fotos"}
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) void upload(fs); }} />
          </label>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      <p className="mt-1 text-xs text-zinc-400">{imageSpecText(kind)}</p>
    </div>
  );
}

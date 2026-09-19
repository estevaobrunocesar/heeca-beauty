"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 space-y-2">
      <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard indisponível (http sem https em alguns navegadores) */
            }
          }}
        >
          {copied ? "Copiado!" : "Copiar link"}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="btn-secondary">Abrir</a>
      </div>
    </div>
  );
}

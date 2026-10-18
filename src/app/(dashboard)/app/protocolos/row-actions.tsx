"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteProtocolAction, toggleProtocolAction } from "@/actions/treatments";

export function ProtocolRowActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      <Link href={`/app/protocolos/${id}`} className="btn-ghost px-2 py-1 text-xs">Editar</Link>
      <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => toggleProtocolAction(id))}>{active ? "Desativar" : "Ativar"}</button>
      <button
        className="btn-ghost px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" disabled={pending}
        onClick={() => { if (confirm("Excluir este protocolo?")) start(async () => { const r = await deleteProtocolAction(id); setError(r && !r.ok ? r.error : null); }); }}
      >Excluir</button>
      {error && <p role="alert" className="basis-full text-right text-xs text-rose-600">{error}</p>}
    </div>
  );
}

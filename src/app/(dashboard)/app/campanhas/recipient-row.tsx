"use client";

import Link from "next/link";
import { useTransition } from "react";
import { desfazerEnvioAction, markCampaignSentAction } from "@/actions/campaigns";
import type { CampaignKind } from "@/lib/campaigns/rules";

export type RecipientProps = {
  id: string; name: string; detalhe: string; enviada: boolean;
  /** Link wa.me já com a mensagem pronta; null quando a cliente não tem telefone. */
  whatsappHref: string | null;
  kind: CampaignKind;
  /** Aniversário: a data do aniversário (define o ano do envio). Reativação: hoje. */
  dia: string;
};

/** Uma cliente da campanha: abre o WhatsApp com a mensagem pronta e registra o envio para não repetir. */
export function RecipientRow({ r }: { r: RecipientProps }) {
  const [pending, start] = useTransition();
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${r.enviada ? "opacity-60" : ""}`}>
      <div className="min-w-44 flex-1">
        <Link href={`/app/clientes/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
        <p className="text-xs text-zinc-500">{r.detalhe}{!r.whatsappHref && " · sem telefone"}</p>
      </div>
      <div className="flex items-center gap-2">
        {r.whatsappHref && (
          <a href={r.whatsappHref} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => { if (!r.enviada) start(async () => { await markCampaignSentAction(r.id, r.kind, r.dia); }); }}>
            💬 {r.enviada ? "Abrir de novo" : "Enviar no WhatsApp"}
          </a>
        )}
        {r.enviada ? (
          <>
            <span className="tag tag-ok">Enviada ✓</span>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(async () => { await desfazerEnvioAction(r.id, r.kind, r.dia); })}>Desfazer</button>
          </>
        ) : (
          <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(async () => { await markCampaignSentAction(r.id, r.kind, r.dia); })}>Marcar como enviada</button>
        )}
      </div>
    </li>
  );
}

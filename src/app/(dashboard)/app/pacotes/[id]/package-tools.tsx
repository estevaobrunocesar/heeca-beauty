"use client";

import { useState, useTransition } from "react";
import { cancelClientPackageAction, linkItemAction, reopenClientPackageAction, unlinkItemAction } from "@/actions/packages";
import type { ClientPackageStatus } from "@/generated/prisma/enums";

type Props =
  | { kind: "link"; clientPackageId: string; itemId: string; disabled?: boolean }
  | { kind: "unlink"; clientPackageId: string; itemId: string }
  | { kind: "status"; clientPackageId: string; status: ClientPackageStatus };

export function PackageTools(props: Props) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  if (props.kind === "link") {
    return (
      <span className="flex items-center gap-1">
        <button className="btn-ghost shrink-0 px-2 py-1 text-xs" disabled={pending || props.disabled} onClick={() => start(async () => { const r = await linkItemAction(props.clientPackageId, props.itemId); setErro(r?.ok ? null : r?.error ?? null); })}>Vincular</button>
        {erro && <span className="text-[11px] text-rose-600">{erro}</span>}
      </span>
    );
  }
  if (props.kind === "unlink") {
    return <button className="btn-ghost shrink-0 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" disabled={pending} onClick={() => { if (confirm("Tirar este atendimento do pacote? A sessão volta ao saldo.")) start(() => unlinkItemAction(props.clientPackageId, props.itemId)); }}>Desvincular</button>;
  }
  if (props.status === "CANCELLED") {
    return <button className="btn-secondary mt-2 w-full" disabled={pending} onClick={() => start(() => reopenClientPackageAction(props.clientPackageId))}>Reabrir pacote</button>;
  }
  if (props.status === "COMPLETED") return null;
  return <button className="btn-ghost mt-2 w-full text-rose-600 hover:bg-rose-50" disabled={pending} onClick={() => { if (confirm("Cancelar este pacote? As sessões já realizadas continuam no histórico.")) start(() => cancelClientPackageAction(props.clientPackageId)); }}>Cancelar pacote</button>;
}

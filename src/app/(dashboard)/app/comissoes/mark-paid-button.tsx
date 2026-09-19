"use client";

import { useActionState } from "react";
import { markCommissionsPaidAction } from "@/actions/commissions";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/action-result";

export function MarkPaidButton({ professionalId, fromIso, toIso, pendingCents }: { professionalId: string; fromIso: string; toIso: string; pendingCents: number }) {
  const [state, action] = useActionState<ActionResult, FormData>(async () => markCommissionsPaidAction(professionalId, fromIso, toIso), null);
  return (
    <form action={action} className="flex items-center gap-2">
      <SubmitButton disabled={pendingCents === 0} pendingText="Acertando...">Marcar período como pago</SubmitButton>
      {state && <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-rose-600"}`}>{state.ok ? state.message : state.error}</span>}
    </form>
  );
}

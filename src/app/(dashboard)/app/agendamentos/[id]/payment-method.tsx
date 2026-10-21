"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPaymentMethodAction } from "@/actions/finance";
import { METHODS, METHOD_LABEL, type Method } from "@/lib/finance/rules";

/** Como a cliente pagou o atendimento concluído (alimenta o financeiro e o caixa). Pode ser informado ou corrigido depois. */
export function PaymentMethodPicker({ appointmentId, current }: { appointmentId: string; current: Method | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const escolher = (m: Method) => {
    setError(null);
    start(async () => {
      const r = await setPaymentMethodAction(appointmentId, current === m ? null : m);
      if (r && !r.ok) { setError(r.error); return; }
      router.refresh();
    });
  };
  return (
    <div className="mt-3">
      <p className="text-xs text-zinc-500">Pagamento{current ? "" : " (não informado)"}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {METHODS.map((m) => (
          <button key={m} type="button" disabled={pending} aria-pressed={current === m} onClick={() => escolher(m)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition ${current === m ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"}`}>{METHOD_LABEL[m]}</button>
        ))}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

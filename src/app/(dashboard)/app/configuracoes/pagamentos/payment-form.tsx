"use client";

import { useActionState, useState } from "react";
import { updatePaymentSettingsAction } from "@/actions/payments";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

type Initial = {
  depositMode: "NONE" | "PERCENT" | "FIXED";
  depositPercent: number;
  depositFixed: string;
  depositTimeoutMinutes: number;
  pixProvider: "mock" | "mercadopago";
  tokenMasked: string | null;
  envTokenAvailable: boolean;
};
type Health = { ok: true; account?: string } | { ok: false; error: string };

export function PaymentSettingsForm({ initial, health }: { initial: Initial; health: Health }) {
  const [state, action] = useActionState(updatePaymentSettingsAction, null);
  const [mode, setMode] = useState(initial.depositMode);
  const [provider, setProvider] = useState(initial.pixProvider);

  return (
    <form action={action} className="space-y-6">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}

      <section className="card p-6">
        <h2 className="font-medium">Pagamento antecipado (sinal)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          A cliente paga via Pix ao agendar; pagou = horário confirmado. Reduz faltas. Agendamentos feitos por você no painel não cobram sinal.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([
            ["NONE", "Desligado", "Sem cobrança antecipada"],
            ["PERCENT", "Percentual", "Ex.: 30% do serviço"],
            ["FIXED", "Valor fixo", "Ex.: R$ 20,00 por agendamento"],
          ] as const).map(([value, label, hint]) => (
            <label key={value} className={`cursor-pointer rounded-lg border p-3 text-sm ${mode === value ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
              <input type="radio" name="depositMode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mr-2" />
              <span className="font-medium">{label}</span>
              <span className="block pl-5 text-xs text-zinc-500">{hint}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {mode === "PERCENT" && (
            <div>
              <label className="label" htmlFor="depositPercent">Percentual do serviço</label>
              <div className="flex items-center gap-2">
                <input id="depositPercent" name="depositPercent" type="number" min={1} max={100} defaultValue={initial.depositPercent} className="input" />
                <span className="text-sm text-zinc-500">%</span>
              </div>
            </div>
          )}
          {mode === "FIXED" && (
            <div>
              <label className="label" htmlFor="depositFixed">Valor fixo (R$)</label>
              <input id="depositFixed" name="depositFixed" inputMode="decimal" defaultValue={initial.depositFixed} className="input" />
              <p className="mt-1 text-xs text-zinc-500">Nunca cobra mais que o preço do serviço.</p>
            </div>
          )}
          {mode !== "NONE" && (
            <div>
              <label className="label" htmlFor="depositTimeoutMinutes">Prazo para pagar</label>
              <select id="depositTimeoutMinutes" name="depositTimeoutMinutes" defaultValue={initial.depositTimeoutMinutes} className="input">
                {[10, 15, 20, 30, 45, 60, 120].map((v) => <option key={v} value={v}>{v} min</option>)}
              </select>
              <p className="mt-1 text-xs text-zinc-500">Sem pagamento, o horário é liberado.</p>
            </div>
          )}
        </div>
        {mode === "NONE" && <input type="hidden" name="depositTimeoutMinutes" value={initial.depositTimeoutMinutes} />}
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Conta que recebe o Pix</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${health.ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
            {health.ok ? (health.account ?? "Conectado") : "Erro"}
          </span>
        </div>
        {!health.ok && <p className="mt-2 text-sm text-rose-700">{health.error}</p>}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pixProvider">Provedor</label>
            <select id="pixProvider" name="pixProvider" value={provider} onChange={(e) => setProvider(e.target.value as "mock" | "mercadopago")} className="input">
              <option value="mercadopago">Mercado Pago</option>
              <option value="mock">Simulado (desenvolvimento)</option>
            </select>
          </div>
          {provider === "mercadopago" && (
            <div>
              <label className="label" htmlFor="accessToken">Access token de produção</label>
              <input id="accessToken" name="accessToken" type="password" autoComplete="off" className="input font-mono text-xs" placeholder={initial.tokenMasked ?? "APP_USR-..."} />
              <p className="mt-1 text-xs text-zinc-500">
                {initial.tokenMasked
                  ? <>Salvo: <code>{initial.tokenMasked}</code>. Deixe em branco para manter.</>
                  : initial.envTokenAvailable
                    ? "Usando o token do ambiente (MERCADOPAGO_ACCESS_TOKEN). Informe um token para usar a sua conta."
                    : "Em developers.mercadopago.com → Suas integrações → Credenciais de produção."}
              </p>
              {initial.tokenMasked && (
                <label className="mt-2 flex items-center gap-2 text-xs text-rose-700">
                  <input type="checkbox" name="clearToken" className="h-3.5 w-3.5" /> Remover token salvo
                </label>
              )}
            </div>
          )}
        </div>
        {provider === "mercadopago" && (
          <p className="mt-3 text-xs text-zinc-500">
            O dinheiro cai direto na sua conta Mercado Pago. Para confirmações instantâneas, cadastre o webhook{" "}
            <code>{"{APP_URL}"}/api/webhooks/mercadopago</code> (evento Pagamentos) na sua aplicação MP — sem ele, o sistema confirma por consulta periódica.
          </p>
        )}
      </section>

      <SubmitButton>Salvar pagamentos</SubmitButton>
    </form>
  );
}

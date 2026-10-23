"use client";

import { useActionState, useState, useTransition } from "react";
import { regenerateWebhookTokenAction, updatePaymentSettingsAction } from "@/actions/payments";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

type Initial = {
  depositMode: "NONE" | "PERCENT" | "FIXED";
  depositPercent: number;
  depositFixed: string;
  depositTimeoutMinutes: number;
  /** Há uma chave do Asaas salva (mesmo que ilegível). */
  temChave: boolean;
  tokenMasked: string | null;
  /** Há uma chave salva, mas ela não abre com a chave de segurança atual do servidor: precisa ser informada de novo. */
  tokenIlegivel: boolean;
  /** URL que o estabelecimento cadastra no webhook do Asaas e o token que o Asaas envia de volta. */
  webhookUrl: string;
  webhookToken: string | null;
  /** true = o servidor está no ambiente de testes do Asaas (sandbox). */
  sandbox: boolean;
};
type Health = { ok: true; account?: string } | { ok: false; error: string };

export function PaymentSettingsForm({ initial, health }: { initial: Initial; health: Health }) {
  const [state, action] = useActionState(updatePaymentSettingsAction, null);
  const [mode, setMode] = useState(initial.depositMode);
  const [pending, start] = useTransition();
  const [tokenMsg, setTokenMsg] = useState<string | null>(null);

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
          <h2 className="font-medium">Conta Asaas que recebe o Pix</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${health.ok ? "bg-emerald-100 text-emerald-800" : initial.temChave ? "bg-rose-100 text-rose-800" : "bg-zinc-100 text-zinc-600"}`}>
            {health.ok ? (health.account ?? "Conectado") : initial.temChave ? "Erro" : "Não conectado"}
          </span>
        </div>
        {!health.ok && initial.temChave && <p className="mt-2 text-sm text-rose-700">{health.error}</p>}
        {initial.tokenIlegivel && <p className="mt-2 text-sm text-rose-700">A chave salva não pôde ser lida (a chave de segurança do servidor mudou desde que ela foi salva). Informe a chave de API do Asaas de novo abaixo e salve.</p>}
        {initial.sandbox && <p className="mt-2 text-xs text-amber-700">Este servidor está no ambiente de testes do Asaas (sandbox): use uma chave de sandbox. Nenhum dinheiro real é cobrado.</p>}

        <div className="mt-4 max-w-xl">
          <label className="label" htmlFor="apiKey">Chave de API do Asaas</label>
          <input id="apiKey" name="apiKey" type="password" autoComplete="off" className="input font-mono text-xs" placeholder={initial.tokenMasked ?? "$aact_..."} />
          <p className="mt-1 text-xs text-zinc-500">
            {initial.tokenMasked ? <>Salva: <code>{initial.tokenMasked}</code>. Deixe em branco para manter.</> : "No painel do Asaas: Integrações → Chave de API. O dinheiro cai direto na sua conta Asaas."}
          </p>
          {initial.temChave && (
            <label className="mt-2 flex items-center gap-2 text-xs text-rose-700">
              <input type="checkbox" name="clearKey" className="h-3.5 w-3.5" /> Remover a chave salva (desliga o sinal)
            </label>
          )}
        </div>

        {initial.webhookToken && (
          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <p className="font-medium">Confirmação automática do pagamento</p>
            <p className="mt-1 text-xs text-zinc-600">No Asaas, em Integrações → Webhooks, cadastre a URL e o token abaixo (evento de cobranças). Sem isso, o pagamento só é confirmado quando alguém abre a página de pagamento.</p>
            <dl className="mt-3 space-y-2 text-xs">
              <div><dt className="text-zinc-500">URL do webhook</dt><dd><code className="break-all">{initial.webhookUrl}</code></dd></div>
              <div><dt className="text-zinc-500">Token de autenticação</dt><dd><code className="break-all">{initial.webhookToken}</code></dd></div>
            </dl>
            <button type="button" className="btn-ghost mt-3 px-2 py-1 text-xs" disabled={pending}
              onClick={() => { if (confirm("Gerar um novo token? O anterior deixa de valer e você precisa atualizá-lo no Asaas.")) start(async () => { const r = await regenerateWebhookTokenAction(); setTokenMsg(r?.ok ? r.message ?? "Feito." : r?.error ?? "Erro"); }); }}>
              Gerar novo token
            </button>
            {tokenMsg && <p className="mt-2 text-xs text-zinc-600">{tokenMsg}</p>}
          </div>
        )}
      </section>

      <SubmitButton>Salvar pagamentos</SubmitButton>
    </form>
  );
}

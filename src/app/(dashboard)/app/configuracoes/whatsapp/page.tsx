import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS, TEMPLATE_PLACEHOLDERS } from "@/lib/whatsapp/templates";
import { getWhatsappDiagnostics, type TemplateCheck } from "@/lib/whatsapp/diagnostics";
import { TemplatesForm } from "./templates-form";
import { Alert } from "@/components/ui/alert";
import { fmtDateTime } from "@/lib/dates";

export default async function WhatsappSettingsPage() {
  const { tenant } = await requireAuth();
  const [overrides, recent, diag] = await Promise.all([
    db.messageTemplate.findMany({ where: { tenantId: tenant.id } }),
    db.whatsappMessage.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 15, include: { client: true } }),
    getWhatsappDiagnostics(),
  ]);

  const kinds = Object.keys(DEFAULT_TEMPLATES) as (keyof typeof DEFAULT_TEMPLATES)[];
  const values = kinds.map((kind) => ({
    kind,
    label: TEMPLATE_LABELS[kind],
    body: overrides.find((o) => o.kind === kind)?.body ?? DEFAULT_TEMPLATES[kind],
  }));

  return (
    <div className="space-y-6">
      <ConnectionStatus diag={diag} />

      {diag.useTemplates ? (
        <Alert kind="info">
          Os textos das mensagens estão sendo enviados pelos <strong>templates aprovados na Meta</strong> (obrigatório fora da janela de 24h).
          Para alterar o texto, edite o template na conta WhatsApp Business. Os modelos abaixo valem apenas para provedores sem template.
        </Alert>
      ) : (
        <TemplatesForm values={values} placeholders={TEMPLATE_PLACEHOLDERS} />
      )}

      <section className="card p-6">
        <h2 className="font-medium">Últimas mensagens</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nenhuma mensagem enviada ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {recent.map((m) => (
              <li key={m.id} className="flex items-start gap-3 py-2">
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs ${m.status === "FAILED" ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-600"}`}>{m.status}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-800">{TEMPLATE_LABELS[m.kind as keyof typeof TEMPLATE_LABELS] ?? m.kind} → {m.client?.name ?? m.phone}</p>
                  <p className="truncate text-xs text-zinc-500">{m.body}</p>
                  {m.error && <p className="text-xs text-rose-600">{m.error}</p>}
                </div>
                <span className="shrink-0 text-xs text-zinc-400">{fmtDateTime(m.createdAt, tenant.timezone)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_STYLE: Record<TemplateCheck["status"], string> = {
  APPROVED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-rose-100 text-rose-800",
  NOT_FOUND: "bg-rose-100 text-rose-800",
  UNKNOWN: "bg-zinc-100 text-zinc-600",
};
const STATUS_LABEL: Record<TemplateCheck["status"], string> = {
  APPROVED: "Aprovado", PENDING: "Em análise", REJECTED: "Rejeitado", NOT_FOUND: "Não cadastrado", UNKNOWN: "—",
};

function ConnectionStatus({ diag }: { diag: Awaited<ReturnType<typeof getWhatsappDiagnostics>> }) {
  const isMeta = diag.providerName === "meta";
  const ok = !diag.configError && diag.health?.ok;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Conexão com o WhatsApp</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
          {diag.configError ? "Não configurado" : ok ? (isMeta ? "Conectado à Meta" : "Modo desenvolvimento") : "Erro"}
        </span>
      </div>

      {!isMeta && !diag.configError && (
        <p className="mt-2 text-sm text-zinc-600">
          As mensagens estão sendo impressas no terminal do servidor. Para enviar de verdade, configure <code>WHATSAPP_PROVIDER=meta</code> e as credenciais no <code>.env</code> (veja <code>docs/whatsapp-meta.md</code>).
        </p>
      )}
      {diag.configError && <p className="mt-2 text-sm text-rose-700">{diag.configError}</p>}
      {diag.health && !diag.health.ok && <p className="mt-2 text-sm text-rose-700">A Meta recusou as credenciais: {diag.health.error}</p>}

      {isMeta && diag.health?.ok && (
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <dt className="text-zinc-500">Número</dt><dd>{diag.health.phoneNumber ?? "—"}</dd>
          <dt className="text-zinc-500">Nome verificado</dt><dd>{diag.health.verifiedName ?? "—"}</dd>
          <dt className="text-zinc-500">Qualidade</dt><dd>{diag.health.qualityRating ?? "—"}</dd>
          <dt className="text-zinc-500">Modo de envio</dt><dd>{diag.useTemplates ? "Templates aprovados" : "Mensagens livres (só janela de 24h!)"}</dd>
        </dl>
      )}

      {isMeta && (
        <>
          <h3 className="mt-5 text-sm font-medium">Templates na conta WhatsApp Business</h3>
          {!diag.health?.ok || !diag.health.templates ? (
            <p className="mt-1 text-xs text-zinc-500">Configure <code>WHATSAPP_BUSINESS_ACCOUNT_ID</code> para verificar automaticamente o status dos templates.</p>
          ) : null}
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {diag.templates.map((t) => (
              <li key={t.kind} className="flex items-center justify-between gap-3 py-1.5">
                <span>
                  {TEMPLATE_LABELS[t.kind]} <code className="ml-1 rounded bg-zinc-100 px-1 text-xs">{t.name}</code> <span className="text-xs text-zinc-400">{t.language}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-5 text-sm font-medium">Webhook</h3>
      <p className="mt-1 text-xs text-zinc-500">Cadastre no app da Meta (WhatsApp → Configuração → Webhooks), assinando o campo <code>messages</code>:</p>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[140px_1fr]">
        <dt className="text-zinc-500">URL de callback</dt><dd><code className="break-all text-xs">{diag.webhookUrl}</code></dd>
        <dt className="text-zinc-500">Verify token</dt><dd><code className="text-xs">{diag.verifyToken ?? "(defina WHATSAPP_VERIFY_TOKEN)"}</code></dd>
      </dl>
    </section>
  );
}

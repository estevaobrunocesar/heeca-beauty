import "server-only";
import { getWhatsappProvider } from "./index";
import { META_TEMPLATES, metaTemplateLanguage, metaTemplateName, metaTemplatesEnabled, type OutboundKind } from "./meta-templates";
import type { ProviderHealth } from "./provider";

export type TemplateCheck = { kind: OutboundKind; name: string; language: string; status: "APPROVED" | "PENDING" | "REJECTED" | "NOT_FOUND" | "UNKNOWN" };

export type WhatsappDiagnostics = {
  providerName: string;
  configError: string | null;
  health: ProviderHealth | null;
  useTemplates: boolean;
  templates: TemplateCheck[];
  webhookUrl: string;
  verifyToken: string | null;
};

/** Reúne tudo que a tela de configuração precisa para mostrar o estado da integração. */
export async function getWhatsappDiagnostics(): Promise<WhatsappDiagnostics> {
  const providerName = (process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase();
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const useTemplates = metaTemplatesEnabled();
  const language = metaTemplateLanguage();

  let configError: string | null = null;
  let health: ProviderHealth | null = null;
  try {
    const provider = getWhatsappProvider();
    health = provider.healthCheck ? await provider.healthCheck() : null;
  } catch (err) {
    configError = err instanceof Error ? err.message : String(err);
  }

  const remote = health?.ok ? health.templates : undefined;
  const templates: TemplateCheck[] = (Object.keys(META_TEMPLATES) as OutboundKind[]).map((kind) => {
    const name = metaTemplateName(kind);
    if (!remote) return { kind, name, language, status: "UNKNOWN" };
    const found = remote.find((t) => t.name === name && t.language === language) ?? remote.find((t) => t.name === name);
    const status = !found ? "NOT_FOUND" : found.status === "APPROVED" ? "APPROVED" : found.status === "REJECTED" ? "REJECTED" : "PENDING";
    return { kind, name, language, status };
  });

  return {
    providerName,
    configError,
    health,
    useTemplates,
    templates,
    webhookUrl: `${base}/api/webhooks/whatsapp`,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? null,
  };
}

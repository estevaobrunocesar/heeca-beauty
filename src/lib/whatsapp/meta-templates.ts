import type { MessageKind } from "@/generated/prisma/enums";

export type OutboundKind = Exclude<MessageKind, "INBOUND">;

/** Variáveis disponíveis para montar uma mensagem (mesmas dos templates editáveis). */
export type MessageVars = {
  cliente: string; servico: string; profissional: string; estabelecimento: string;
  data: string; hora: string; quando: string; link: string; link_agenda: string;
  token: string; slug: string; orientacoes: string;
  valor_sinal: string; prazo_pagamento: string; link_pagamento: string;
};

export type MetaTemplateSpec = {
  /** Nome padrão; pode ser sobrescrito por WHATSAPP_TEMPLATE_<KIND>. */
  defaultName: string;
  category: "UTILITY";
  /** Corpo exatamente como deve ser cadastrado na Meta ({{1}}, {{2}}...). */
  body: string;
  /** Ordem dos parâmetros do corpo. */
  params: (keyof MessageVars)[];
  /** Botões, na ordem em que devem ser cadastrados. */
  buttons?: (
    | { type: "quick_reply"; text: string; payload: (v: MessageVars) => string }
    | { type: "url"; text: string; urlPrefix: string; suffix: (v: MessageVars) => string }
  )[];
  /** Exemplo de valores para a Meta aprovar o template. */
  example: string[];
};

/**
 * Templates que precisam existir na conta WhatsApp Business (WABA).
 * O texto aqui é a fonte da verdade: docs/whatsapp-meta.md é gerado a partir dele
 * e `sendTemplate` envia os parâmetros nesta mesma ordem.
 */
export const META_TEMPLATES: Record<OutboundKind, MetaTemplateSpec> = {
  // Catálogo UNIFICADO da plataforma (fonte da verdade: heeca_notify/src/lib/templates.ts) — o mesmo para todas as marcas;
  // o vocabulário do segmento entra pelas variáveis. Botões de URL mandam só o sufixo: o Notify prefixa o produto e o
  // portal (heeca.com.br/a/… e /p/…) redireciona para o host da marca.
  REQUEST_CONFIRMATION: {
    defaultName: "heeca_confirmacao",
    category: "UTILITY",
    body: "Olá, {{1}}! {{2}} recebeu sua solicitação: {{3}} com {{4}}, {{5}} às {{6}}. Toque em Confirmar para garantir seu horário.",
    params: ["cliente", "estabelecimento", "servico", "profissional", "data", "hora"],
    buttons: [
      { type: "quick_reply", text: "Confirmar", payload: (v) => `confirm:${v.token}` },
      { type: "quick_reply", text: "Remarcar", payload: (v) => `reschedule:${v.token}` },
      { type: "quick_reply", text: "Cancelar", payload: (v) => `cancel:${v.token}` },
    ],
    example: ["Maria", "Studio Ana", "Alongamento em gel", "Ana", "20/09/2026", "14:00"],
  },
  CONFIRMED: {
    defaultName: "heeca_confirmado",
    category: "UTILITY",
    body: "Horário confirmado ✅ {{1}}: {{2}} com {{3}}, {{4}} às {{5}}. {{6}}Até lá!",
    // {{6}} = orientações pré-atendimento (pode ser vazio; a Meta exige valor, então enviamos " ")
    params: ["estabelecimento", "servico", "profissional", "data", "hora", "orientacoes"],
    example: ["Studio Ana", "Alongamento em gel", "Ana", "20/09/2026", "14:00", "Chegue alguns minutos antes. "],
  },
  REMINDER: {
    defaultName: "heeca_lembrete",
    category: "UTILITY",
    body: "Oi, {{1}}! Lembrete de {{2}}: {{3}}, {{4}} às {{5}}. Se precisar mudar, use os botões abaixo.",
    params: ["cliente", "estabelecimento", "servico", "quando", "hora"],
    buttons: [
      { type: "quick_reply", text: "Remarcar", payload: (v) => `reschedule:${v.token}` },
      { type: "quick_reply", text: "Cancelar", payload: (v) => `cancel:${v.token}` },
    ],
    example: ["Maria", "Studio Ana", "Alongamento em gel", "amanhã", "14:00"],
  },
  CANCELLED: {
    defaultName: "heeca_cancelado",
    category: "UTILITY",
    body: "Aviso de {{1}}: seu horário de {{2}}, {{3}} às {{4}}, foi cancelado. Para marcar de novo, é só tocar no botão.",
    params: ["estabelecimento", "servico", "data", "hora"],
    buttons: [{ type: "url", text: "Agendar novamente", urlPrefix: "https://heeca.com.br/a/", suffix: (v) => v.slug }],
    example: ["Studio Ana", "Alongamento em gel", "20/09/2026", "14:00"],
  },
  PAYMENT_REQUEST: {
    defaultName: "heeca_sinal",
    category: "UTILITY",
    body: "Olá, {{1}}! Para garantir seu horário de {{2}} em {{3}}, {{4}} às {{5}}, pague o sinal de {{6}} via Pix em até {{7}}. Toque no botão para ver o QR Code.",
    params: ["cliente", "servico", "estabelecimento", "data", "hora", "valor_sinal", "prazo_pagamento"],
    buttons: [{ type: "url", text: "Pagar sinal", urlPrefix: "https://heeca.com.br/p/", suffix: (v) => v.token }],
    example: ["Maria", "Alongamento em gel", "Studio Ana", "20/09/2026", "14:00", "R$ 20,00", "30 minutos"],
  },
  RESCHEDULED: {
    defaultName: "heeca_remarcado",
    category: "UTILITY",
    body: "Aviso de {{1}}: seu horário de {{2}} foi remarcado para {{3}} às {{4}}. Qualquer dúvida, responda esta mensagem.",
    params: ["estabelecimento", "servico", "data", "hora"],
    example: ["Studio Ana", "Alongamento em gel", "21/09/2026", "15:00"],
  },
};

export function metaTemplateName(kind: OutboundKind): string {
  return process.env[`WHATSAPP_TEMPLATE_${kind}`] || META_TEMPLATES[kind].defaultName;
}

export function metaTemplateLanguage(): string {
  return process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR";
}

/** Usar templates? Padrão: sim quando o provider é a Meta (único modo seguro fora da janela de 24h). */
export function metaTemplatesEnabled(): boolean {
  const flag = process.env.WHATSAPP_USE_TEMPLATES?.trim().toLowerCase();
  if (flag) return flag !== "false" && flag !== "0";
  const p = (process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase();
  return p === "meta" || p === "notify"; // pelo Notify a entrega final também é a Meta: templates fora da janela de 24 h
}

/** Renderiza o corpo do template Meta com os valores (para log/pré-visualização). */
export function renderMetaBody(kind: OutboundKind, vars: MessageVars): string {
  const spec = META_TEMPLATES[kind];
  return spec.body.replace(/\{\{(\d+)\}\}/g, (_, i: string) => vars[spec.params[Number(i) - 1]] ?? "");
}

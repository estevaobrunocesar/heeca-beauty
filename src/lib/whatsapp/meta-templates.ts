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
  REQUEST_CONFIRMATION: {
    defaultName: "heeca_solicitacao_agendamento",
    category: "UTILITY",
    body: "Olá, {{1}}! 💅 Recebemos sua solicitação de agendamento. Procedimento: {{2}}. Profissional: {{3}}. Data: {{4}} às {{5}}. Toque em Confirmar para garantir seu horário.",
    params: ["cliente", "servico", "profissional", "data", "hora"],
    buttons: [
      { type: "quick_reply", text: "Confirmar", payload: (v) => `confirm:${v.token}` },
      { type: "quick_reply", text: "Remarcar", payload: (v) => `reschedule:${v.token}` },
      { type: "quick_reply", text: "Cancelar", payload: (v) => `cancel:${v.token}` },
    ],
    example: ["Maria", "Alongamento em Fibra de Vidro", "Ana", "20/09/2026", "14:00"],
  },
  CONFIRMED: {
    defaultName: "heeca_agendamento_confirmado",
    category: "UTILITY",
    body: "✨ Agendamento confirmado! Procedimento: {{1}}. Profissional: {{2}}. Data: {{3}} às {{4}}. {{5}}Estamos te esperando! 💅",
    // {{5}} = orientações pré-atendimento (pode ser vazio; a Meta exige valor, então enviamos " ")
    params: ["servico", "profissional", "data", "hora", "orientacoes"],
    example: ["Alongamento em Fibra de Vidro", "Ana", "20/09/2026", "14:00", "Chegue alguns minutos antes e venha sem esmalte. "],
  },
  REMINDER: {
    defaultName: "heeca_lembrete",
    category: "UTILITY",
    body: "Oi, {{1}}! 💖 Lembrando que seu horário em {{3}} está agendado para {{4}}, às {{5}}. Procedimento: {{2}}. Até lá! ✨",
    params: ["cliente", "servico", "estabelecimento", "quando", "hora"],
    buttons: [
      { type: "quick_reply", text: "Remarcar", payload: (v) => `reschedule:${v.token}` },
      { type: "quick_reply", text: "Cancelar", payload: (v) => `cancel:${v.token}` },
    ],
    example: ["Maria", "Corte + Escova", "Salão Bela Vista", "amanhã", "14:00"],
  },
  CANCELLED: {
    defaultName: "heeca_agendamento_cancelado",
    category: "UTILITY",
    body: "Seu agendamento de {{1}} em {{2}} às {{3}} foi cancelado. Caso queira, é só marcar um novo horário pelo botão abaixo.",
    params: ["servico", "data", "hora"],
    buttons: [{ type: "url", text: "Agendar novamente", urlPrefix: "/agendar/", suffix: (v) => v.slug }],
    example: ["Alongamento em Fibra de Vidro", "20/09/2026", "14:00"],
  },
  PAYMENT_REQUEST: {
    defaultName: "heeca_pedido_sinal",
    category: "UTILITY",
    body: "Olá, {{1}}! Para garantir seu horário de *{{2}}* em {{3}} às {{4}}, pague o sinal de {{5}} via Pix em até {{6}}. Toque no botão para ver o QR Code.",
    params: ["cliente", "servico", "data", "hora", "valor_sinal", "prazo_pagamento"],
    buttons: [{ type: "url", text: "Pagar sinal", urlPrefix: "/pagar/", suffix: (v) => v.token }],
    example: ["Maria", "Alongamento em Fibra de Vidro", "20/09/2026", "14:00", "R$ 20,00", "30 minutos"],
  },
  RESCHEDULED: {
    defaultName: "heeca_agendamento_remarcado",
    category: "UTILITY",
    body: "🔁 Seu horário de {{1}} foi remarcado para {{2}} às {{3}}. Qualquer dúvida, é só responder esta mensagem. 💅",
    params: ["servico", "data", "hora"],
    example: ["Alongamento em Fibra de Vidro", "21/09/2026", "15:00"],
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
  return (process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase() === "meta";
}

/** Renderiza o corpo do template Meta com os valores (para log/pré-visualização). */
export function renderMetaBody(kind: OutboundKind, vars: MessageVars): string {
  const spec = META_TEMPLATES[kind];
  return spec.body.replace(/\{\{(\d+)\}\}/g, (_, i: string) => vars[spec.params[Number(i) - 1]] ?? "");
}

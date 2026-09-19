import type { MessageKind } from "@/generated/prisma/enums";

/**
 * Templates padrão (seção 8 da especificação). A profissional pode sobrescrever
 * cada um em Configurações → WhatsApp; os placeholders são substituídos em `renderTemplate`.
 *
 * {{orientacoes}} vira as orientações pré-atendimento configuradas (seção 8.4) — ou vazio.
 * {{servico}} já inclui os adicionais ("Alongamento em fibra + Nail art").
 */
export const DEFAULT_TEMPLATES: Record<Exclude<MessageKind, "INBOUND">, string> = {
  REQUEST_CONFIRMATION:
    "Olá, {{cliente}}! 💜\nRecebemos sua solicitação de agendamento:\n\n" +
    "Serviço: {{servico}}\nData: {{data}}\nHorário: {{hora}}\nProfissional: {{profissional}}\n\n" +
    "Toque no botão abaixo para confirmar seu horário, ou acesse: {{link}}",
  CONFIRMED:
    "✨ Agendamento confirmado!\n\nServiço: {{servico}}\nData: {{data}}\nHorário: {{hora}}\nProfissional: {{profissional}}\n\n" +
    "{{orientacoes}}Estamos te esperando! 💜",
  REMINDER:
    "Oi, {{cliente}}! 💖\nLembrando que seu horário está agendado para {{quando}}, às {{hora}}.\n\n" +
    "Serviço: {{servico}}\n\n{{orientacoes}}Até lá! ✨",
  CANCELLED:
    "Seu agendamento de {{servico}} em {{data}} às {{hora}} foi cancelado conforme solicitado. " +
    "Caso queira, você pode realizar um novo agendamento pelo nosso link: {{link_agenda}}",
  PAYMENT_REQUEST:
    "Olá, {{cliente}}! 💜 Para confirmar seu horário de *{{servico}}* em {{data}} às {{hora}}, é necessário o pagamento de um sinal de {{valor_sinal}} via Pix em até {{prazo_pagamento}}: {{link_pagamento}}",
  RESCHEDULED:
    "🔁 Seu horário foi remarcado!\n\nServiço: {{servico}}\nNova data: {{data}}\nNovo horário: {{hora}}\n\n{{orientacoes}}Qualquer dúvida, é só responder esta mensagem. 💜",
};

export const TEMPLATE_LABELS: Record<Exclude<MessageKind, "INBOUND">, string> = {
  REQUEST_CONFIRMATION: "Solicitação de confirmação",
  CONFIRMED: "Agendamento confirmado",
  REMINDER: "Lembrete",
  CANCELLED: "Cancelamento",
  RESCHEDULED: "Reagendamento",
  PAYMENT_REQUEST: "Pedido de pagamento (sinal)",
};

export const TEMPLATE_PLACEHOLDERS = [
  "{{cliente}}", "{{servico}}", "{{profissional}}", "{{estabelecimento}}",
  "{{data}}", "{{hora}}", "{{quando}}", "{{link}}", "{{link_agenda}}", "{{orientacoes}}",
  "{{valor_sinal}}", "{{prazo_pagamento}}", "{{link_pagamento}}",
];

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

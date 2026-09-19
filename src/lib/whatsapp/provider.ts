/**
 * Abstração do envio de WhatsApp.
 * Implementações: ConsoleProvider (dev) e MetaCloudProvider (WhatsApp Business Cloud API).
 * Outros provedores (Z-API, Twilio, Evolution...) basta implementar esta interface.
 */

export type QuickReplyButton = { id: string; title: string }; // title: máx. 20 caracteres na Meta

/** Mensagem livre (texto ou botões). Na Meta só é aceita dentro da janela de 24h. */
export type OutboundMessage = {
  to: string;   // E.164
  body: string; // texto final (também usado para log e provedores sem template)
  buttons?: QuickReplyButton[];
};

/**
 * Mensagem baseada em template pré-aprovado (obrigatório na Meta fora da janela de 24h).
 * `bodyParams` preenche {{1}}, {{2}}... na ordem; `buttons` preenche os botões dinâmicos.
 */
export type TemplateMessage = {
  to: string;
  name: string;
  language: string;
  bodyParams: string[];
  buttons?: ({ type: "quick_reply"; payload: string } | { type: "url"; text: string })[];
  body: string; // versão renderizada para log
};

export type SendResult = { providerMessageId?: string };

export type ProviderHealth =
  | { ok: true; phoneNumber?: string; verifiedName?: string; qualityRating?: string; templates?: { name: string; status: string; language: string }[] }
  | { ok: false; error: string };

export interface WhatsappProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<SendResult>;
  /** Provedores que exigem templates implementam este método. */
  sendTemplate?(message: TemplateMessage): Promise<SendResult>;
  /** Diagnóstico exibido em Configurações → WhatsApp. */
  healthCheck?(): Promise<ProviderHealth>;
}

/** Evento normalizado recebido via webhook (independente do provedor). */
export type InboundEvent =
  | { type: "button_reply"; from: string; buttonId: string; providerMessageId: string }
  | { type: "text"; from: string; text: string; providerMessageId: string }
  | { type: "status"; providerMessageId: string; status: "sent" | "delivered" | "read" | "failed"; error?: string };

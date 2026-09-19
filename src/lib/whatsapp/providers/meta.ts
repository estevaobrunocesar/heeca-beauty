import type { InboundEvent, OutboundMessage, ProviderHealth, SendResult, TemplateMessage, WhatsappProvider } from "../provider";

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * WhatsApp Business Cloud API (Meta).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Regra da Meta: mensagens livres (`send`) só dentro da janela de 24h após a última
 * mensagem do cliente. Fora dela, apenas templates aprovados (`sendTemplate`).
 * Como o cliente agenda pela página pública sem ter escrito antes, o sistema usa
 * templates por padrão — veja docs/whatsapp-meta.md.
 */
export class MetaCloudProvider implements WhatsappProvider {
  readonly name = "meta";

  constructor(
    private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? "",
    private readonly businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "",
  ) {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error("WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN não configurados");
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${GRAPH}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message: string; code?: number; error_subcode?: number } };
    if (!res.ok || json.error) {
      const e = json.error;
      throw new Error(e ? `Meta API (${e.code ?? res.status}${e.error_subcode ? `/${e.error_subcode}` : ""}): ${e.message}` : `Meta API HTTP ${res.status}`);
    }
    return json;
  }

  private async postMessage(payload: Record<string, unknown>): Promise<SendResult> {
    const json = await this.request<{ messages?: { id: string }[] }>(`${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    });
    return { providerMessageId: json.messages?.[0]?.id };
  }

  /** Mensagem livre — funciona apenas dentro da janela de 24h. */
  async send(message: OutboundMessage): Promise<SendResult> {
    const to = message.to.replace(/\D/g, "");
    if (message.buttons?.length) {
      return this.postMessage({
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: message.body },
          action: {
            buttons: message.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })),
          },
        },
      });
    }
    return this.postMessage({ to, type: "text", text: { body: message.body, preview_url: true } });
  }

  /** Template aprovado — obrigatório fora da janela de 24h. */
  async sendTemplate(message: TemplateMessage): Promise<SendResult> {
    const components: Record<string, unknown>[] = [];
    if (message.bodyParams.length) {
      components.push({
        type: "body",
        // Parâmetros de corpo não podem ter quebras de linha nem mais de 4 espaços seguidos.
        parameters: message.bodyParams.map((text) => ({ type: "text", text: text.replace(/\s*\n\s*/g, " ").replace(/ {4,}/g, "   ") })),
      });
    }
    message.buttons?.forEach((b, index) => {
      components.push(
        b.type === "quick_reply"
          ? { type: "button", sub_type: "quick_reply", index, parameters: [{ type: "payload", payload: b.payload }] }
          : { type: "button", sub_type: "url", index, parameters: [{ type: "text", text: b.text }] },
      );
    });
    return this.postMessage({
      to: message.to.replace(/\D/g, ""),
      type: "template",
      template: { name: message.name, language: { code: message.language }, components },
    });
  }

  /** Verifica credenciais, número e (se WABA configurada) os templates cadastrados. */
  async healthCheck(): Promise<ProviderHealth> {
    try {
      const phone = await this.request<{ display_phone_number?: string; verified_name?: string; quality_rating?: string }>(
        `${this.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      );
      let templates: { name: string; status: string; language: string }[] | undefined;
      if (this.businessAccountId) {
        const list = await this.request<{ data?: { name: string; status: string; language: string }[] }>(
          `${this.businessAccountId}/message_templates?fields=name,status,language&limit=100`,
        );
        templates = list.data ?? [];
      }
      return { ok: true, phoneNumber: phone.display_phone_number, verifiedName: phone.verified_name, qualityRating: phone.quality_rating, templates };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Converte o payload do webhook da Meta em eventos normalizados. */
  static parseWebhook(payload: unknown): InboundEvent[] {
    const events: InboundEvent[] = [];
    const body = payload as { entry?: { changes?: { value?: MetaWebhookValue }[] }[] };
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        for (const msg of value.messages ?? []) {
          const from = "+" + msg.from;
          if (msg.type === "interactive" && msg.interactive?.button_reply) {
            events.push({ type: "button_reply", from, buttonId: msg.interactive.button_reply.id, providerMessageId: msg.id });
          } else if (msg.type === "button" && msg.button?.payload) {
            // Botões de quick-reply de templates chegam como type "button" com o payload dinâmico
            events.push({ type: "button_reply", from, buttonId: msg.button.payload, providerMessageId: msg.id });
          } else if (msg.type === "text" && msg.text?.body) {
            events.push({ type: "text", from, text: msg.text.body, providerMessageId: msg.id });
          }
        }
        for (const st of value.statuses ?? []) {
          const status = st.status;
          if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
            events.push({ type: "status", providerMessageId: st.id, status, error: st.errors?.[0]?.title });
          }
        }
      }
    }
    return events;
  }
}

type MetaWebhookValue = {
  messages?: {
    id: string;
    from: string;
    type: string;
    text?: { body: string };
    button?: { payload: string; text: string };
    interactive?: { type: string; button_reply?: { id: string; title: string } };
  }[];
  statuses?: { id: string; status: string; errors?: { title: string }[] }[];
};

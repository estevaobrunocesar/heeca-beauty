import type { OutboundMessage, ProviderHealth, SendResult, TemplateMessage, WhatsappProvider } from "../provider";

/** Provedor de desenvolvimento: imprime a mensagem no terminal do servidor. */
export class ConsoleProvider implements WhatsappProvider {
  readonly name = "console";

  private print(to: string, body: string, footer?: string) {
    console.log(
      `\n┌─ WhatsApp → ${to}\n` + body.split("\n").map((l) => `│ ${l}`).join("\n") + (footer ? `\n│\n│ ${footer}` : "") + `\n└─────────────────────────────\n`,
    );
    return { providerMessageId: `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const buttons = message.buttons?.map((b) => `[${b.title}] (id=${b.id})`).join("  ");
    return this.print(message.to, message.body, buttons);
  }

  /** Simula o modo template (WHATSAPP_USE_TEMPLATES=true) para testar sem a Meta. */
  async sendTemplate(message: TemplateMessage): Promise<SendResult> {
    const buttons = message.buttons?.map((b) => (b.type === "quick_reply" ? `[quick_reply payload=${b.payload}]` : `[url suffix=${b.text}]`)).join("  ");
    return this.print(message.to, `(template ${message.name}/${message.language})\n${message.body}`, buttons);
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: true, verifiedName: "Modo de desenvolvimento (console)" };
  }
}

import "server-only";
import { Resend } from "resend";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Dev: imprime o e-mail (e o link, quando houver) no terminal do servidor. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(m: EmailMessage) {
    console.log(`\n┌─ E-mail → ${m.to}\n│ Assunto: ${m.subject}\n│\n${m.text.split("\n").map((l) => `│ ${l}`).join("\n")}\n└─────────────────────────────\n`);
  }
}

/** Produção: Resend (https://resend.com). Requer domínio verificado para o remetente. */
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend;
  private from: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) throw new Error("RESEND_API_KEY / EMAIL_FROM não configurados");
    this.client = new Resend(key);
    this.from = from;
  }

  async send(m: EmailMessage) {
    const { error } = await this.client.emails.send({ from: this.from, to: m.to, subject: m.subject, html: m.html, text: m.text });
    if (error) throw new Error(`Resend: ${error.name} — ${error.message}`);
  }
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const name = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();
  cached = name === "resend" ? new ResendEmailProvider() : new ConsoleEmailProvider();
  return cached;
}

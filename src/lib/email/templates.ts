import type { EmailMessage } from "./index";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Layout mínimo e compatível com clientes de e-mail (tabelas + estilos inline). */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e4e4e7;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-size:22px;font-weight:600">Heeca<span style="color:#c9821f">.</span></td></tr>
<tr><td style="padding:8px 28px 0;font-size:18px;font-weight:600">${escape(title)}</td></tr>
<tr><td style="padding:12px 28px 28px;font-size:15px;line-height:1.55;color:#3f3f46">${bodyHtml}</td></tr>
</table>
<p style="max-width:480px;margin:16px 0 0;font-size:12px;color:#a1a1aa">Você recebeu este e-mail porque existe uma conta Heeca com este endereço.</p>
</td></tr></table></body></html>`;
}

export function passwordResetEmail(opts: { to: string; name: string; url: string; expiresInMinutes: number }): EmailMessage {
  const first = escape(opts.name.split(" ")[0]);
  const html = layout(
    "Redefinir sua senha",
    `<p>Olá, ${first}!</p>
<p>Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha. O link vale por ${opts.expiresInMinutes} minutos.</p>
<p style="margin:24px 0"><a href="${escape(opts.url)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Redefinir senha</a></p>
<p style="font-size:13px;color:#71717a">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${escape(opts.url)}" style="color:#a86618;word-break:break-all">${escape(opts.url)}</a></p>
<p style="font-size:13px;color:#71717a">Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.</p>`,
  );
  const text = `Olá, ${opts.name.split(" ")[0]}!

Recebemos um pedido para redefinir a senha da sua conta Heeca.
Acesse o link abaixo para escolher uma nova senha (válido por ${opts.expiresInMinutes} minutos):

${opts.url}

Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.`;

  return { to: opts.to, subject: "Redefinir sua senha — Heeca", html, text };
}

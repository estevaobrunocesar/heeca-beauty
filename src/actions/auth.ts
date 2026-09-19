"use server";

import { redirect } from "next/navigation";
import { platformEnabled, portalUrl } from "@/lib/heeca/service";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { bootstrapTenant, uniqueTenantSlug } from "@/lib/tenant-bootstrap";
import { normalizePhone } from "@/lib/phone";
import { fail, success, type ActionResult } from "@/lib/action-result";
import { getEmailProvider } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email/templates";

const registerSchema = z.object({
  businessName: z.string().trim().min(2, "Informe o nome do estabelecimento"),
  ownerName: z.string().trim().min(2, "Informe seu nome"),
  email: z.string().trim().email("E-mail inválido").toLowerCase(),
  phone: z.string().trim().min(8, "Informe seu WhatsApp"),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
});

export async function registerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (platformEnabled()) return fail(`Crie sua conta pelo portal Heeca: ${portalUrl()}/produtos/nail`);
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;

  const phone = normalizePhone(data.phone);
  if (!phone) return fail("WhatsApp inválido. Use o formato (11) 99999-8888.");
  if (await db.user.findUnique({ where: { email: data.email } })) return fail("Já existe uma conta com este e-mail.");

  const slug = await uniqueTenantSlug(data.businessName);
  const passwordHash = await hashPassword(data.password);

  const { user } = await db.$transaction((tx) =>
    bootstrapTenant(tx, { slug, businessName: data.businessName, ownerName: data.ownerName, ownerEmail: data.email, passwordHash, phone }),
  );

  await createSession({ userId: user.id, tenantId: user.tenantId });
  redirect("/app?bemvindo=1");
}

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").toLowerCase(),
  password: z.string().min(1, "Informe a senha"),
});

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails existem.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return fail("E-mail ou senha incorretos.");

  await createSession({ userId: user.id, tenantId: user.tenantId });
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const RESET_TOKEN_MINUTES = 60;

export async function requestPasswordResetAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    // Só o hash vai para o banco: quem ler a tabela não consegue montar o link.
    const token = randomBytes(32).toString("base64url");
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000) },
    });
    const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/redefinir-senha/${token}`;
    try {
      await getEmailProvider().send(passwordResetEmail({ to: user.email, name: user.name, url, expiresInMinutes: RESET_TOKEN_MINUTES }));
    } catch (err) {
      // Não revela ao usuário se o e-mail existe; registra para o operador.
      console.error("[email] falha ao enviar recuperação de senha:", err);
    }
  }
  // Mesma resposta com ou sem conta: não permite descobrir e-mails cadastrados.
  return success("Se o e-mail existir, enviaremos um link para redefinir a senha.");
}

export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return fail("A senha deve ter ao menos 8 caracteres");

  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return fail("Link inválido ou expirado.");

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  redirect("/login?redefinida=1");
}

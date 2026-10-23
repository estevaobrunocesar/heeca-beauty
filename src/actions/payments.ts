"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto";
import { parseMoneyToCents } from "@/lib/money";
import { pixProviderFor } from "@/lib/payments";
import { cleanApiKey } from "@/lib/payments/asaas-rules";
import { fail, success, type ActionResult } from "@/lib/action-result";

const schema = z.object({
  depositMode: z.enum(["NONE", "PERCENT", "FIXED"]),
  depositPercent: z.coerce.number().int().min(1).max(100).optional(),
  depositFixed: z.string().optional().or(z.literal("")),
  depositTimeoutMinutes: z.coerce.number().int().min(5).max(1440),
  apiKey: z.string().optional().or(z.literal("")),
  clearKey: z.string().optional(),
});

/** Sinal via Pix pelo Asaas: cada estabelecimento usa a própria conta (chave de API criptografada no banco). Só o dono altera. */
export async function updatePaymentSettingsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.isOwner) return fail("Apenas o responsável pode alterar pagamentos.");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  let depositValue = 0;
  if (d.depositMode === "PERCENT") {
    if (!d.depositPercent) return fail("Informe o percentual do sinal.");
    depositValue = d.depositPercent;
  } else if (d.depositMode === "FIXED") {
    const cents = parseMoneyToCents(d.depositFixed ?? "");
    if (cents == null || cents < 100) return fail("Informe um valor fixo de ao menos R$ 1,00.");
    depositValue = cents;
  }

  // Chave: só grava se veio uma nova (testada antes); "clearKey" remove; senão mantém a que já está.
  let pixCredentialsEnc: string | null | undefined = undefined;
  if (d.clearKey === "on") pixCredentialsEnc = null;
  else if (d.apiKey?.trim()) {
    const key = cleanApiKey(d.apiKey);
    if (!key) return fail("A chave de API do Asaas parece incompleta. Copie-a inteira no painel do Asaas (Integrações → Chave de API).");
    const check = await pixProviderFor("asaas", key).healthCheck();
    if (!check.ok) return fail(`Chave recusada: ${check.error}`);
    pixCredentialsEnc = encryptSecret(key);
  }

  const temChave = pixCredentialsEnc !== undefined ? pixCredentialsEnc !== null : !!ctx.tenant.pixCredentialsEnc;
  if (d.depositMode !== "NONE" && !temChave) return fail("Para cobrar sinal, informe a chave de API do Asaas.");

  await db.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      depositMode: d.depositMode,
      depositValue,
      depositTimeoutMinutes: d.depositTimeoutMinutes,
      ...(pixCredentialsEnc !== undefined
        ? pixCredentialsEnc === null
          ? { pixProvider: null, pixCredentialsEnc: null }
          : { pixProvider: "asaas", pixCredentialsEnc }
        : {}),
      // Token do webhook: gerado uma vez quando há chave; o estabelecimento o cola no painel do Asaas.
      ...(temChave && !ctx.tenant.pixWebhookToken ? { pixWebhookToken: randomBytes(24).toString("base64url") } : {}),
    },
  });
  revalidatePath("/app/configuracoes/pagamentos");
  return success("Pagamentos salvos!");
}

/** Gera um novo token de webhook (se o anterior vazou). O estabelecimento precisa atualizar no painel do Asaas. */
export async function regenerateWebhookTokenAction(): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.isOwner) return fail("Apenas o responsável pode alterar pagamentos.");
  if (!ctx.tenant.pixCredentialsEnc) return fail("Informe a chave de API do Asaas antes.");
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { pixWebhookToken: randomBytes(24).toString("base64url") } });
  revalidatePath("/app/configuracoes/pagamentos");
  return success("Novo token gerado. Atualize-o no webhook do Asaas.");
}

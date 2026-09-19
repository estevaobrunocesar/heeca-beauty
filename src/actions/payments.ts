"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto";
import { parseMoneyToCents } from "@/lib/money";
import { pixProviderFor } from "@/lib/payments";
import { fail, success, type ActionResult } from "@/lib/action-result";

const schema = z.object({
  depositMode: z.enum(["NONE", "PERCENT", "FIXED"]),
  depositPercent: z.coerce.number().int().min(1).max(100).optional(),
  depositFixed: z.string().optional().or(z.literal("")),
  depositTimeoutMinutes: z.coerce.number().int().min(5).max(1440),
  pixProvider: z.enum(["mock", "mercadopago"]),
  accessToken: z.string().trim().optional().or(z.literal("")),
  clearToken: z.string().optional(),
});

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

  // Credencial: só grava se veio um token novo; "clearToken" remove; senão mantém.
  let pixCredentialsEnc: string | null | undefined = undefined;
  if (d.clearToken === "on") pixCredentialsEnc = null;
  else if (d.accessToken) {
    const check = await pixProviderFor(d.pixProvider, d.accessToken).healthCheck();
    if (!check.ok) return fail(`Credencial recusada: ${check.error}`);
    pixCredentialsEnc = encryptSecret(d.accessToken);
  }

  if (d.depositMode !== "NONE" && d.pixProvider === "mercadopago") {
    const hasToken = pixCredentialsEnc ?? ctx.tenant.pixCredentialsEnc ?? process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!hasToken) return fail("Para cobrar sinal pelo Mercado Pago, informe o access token.");
  }

  await db.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      depositMode: d.depositMode,
      depositValue,
      depositTimeoutMinutes: d.depositTimeoutMinutes,
      pixProvider: d.pixProvider,
      ...(pixCredentialsEnc !== undefined ? { pixCredentialsEnc } : {}),
    },
  });
  revalidatePath("/app/configuracoes/pagamentos");
  return success("Pagamentos salvos!");
}

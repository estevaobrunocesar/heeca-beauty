import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { normalizePhone } from "@/lib/phone";
import { bootstrapTenant, uniqueTenantSlug } from "@/lib/tenant-bootstrap";
import { MARCAS, type Marca } from "@/lib/marca";
import { marcaAtual } from "@/lib/marca-atual";

/**
 * Integração com o portal heeca.com.br (contrato: heeca_site/docs/ENTITLEMENT.md).
 *
 * O portal é dono de conta, plano e cobrança. Aqui só:
 *  - provisionamos o estabelecimento quando ele manda (/api/heeca/provision);
 *  - espelhamos plano/status/bloqueio no Tenant (/api/heeca/entitlement) — `requireAuth`
 *    bloqueia o painel quando `heecaBlocked`; a página pública de agendamento continua;
 *  - trocamos o token de SSO por uma sessão (/sso/heeca).
 *
 * Variáveis: HEECA_PLATFORM_SECRET (mesmo segredo cadastrado no portal), HEECA_PORTAL_URL.
 */

export const portalUrl = () => (process.env.HEECA_PORTAL_URL ?? "https://heeca.com.br").replace(/\/+$/, "");
/**
 * Slug do produto no portal (catálogo, /produtos/<slug>, /sso/<slug> e `aud` do JWT de SSO) = slug da MARCA
 * do host (lib/marca.ts): beauty.heeca.com.br ↔ produto `beauty`, wellness.heeca.com.br ↔ `wellness`.
 */
export const portalProductUrl = (marca: Marca) => `${portalUrl()}/produtos/${marca.slug}`;
export const portalSsoUrl = (marca: Marca) => `${portalUrl()}/sso/${marca.slug}`;
const secret = () => process.env.HEECA_PLATFORM_SECRET ?? "";
export const platformEnabled = () => secret().length >= 16;

const MAX_SKEW_MS = 5 * 60 * 1000;

/** Assinatura HMAC das chamadas servidor → servidor. Lança em caso de falha. */
export function verifySignature(rawBody: string, headers: Headers, now = Date.now()) {
  const s = secret();
  if (!s) throw new Error("HEECA_PLATFORM_SECRET não configurado.");
  const ts = headers.get("x-heeca-timestamp") ?? "";
  const sig = headers.get("x-heeca-signature") ?? "";
  if (!/^\d+$/.test(ts) || Math.abs(now - Number(ts)) > MAX_SKEW_MS) throw new Error("Assinatura expirada.");
  const expected = createHmac("sha256", s).update(`${ts}.${rawBody}`).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) throw new Error("Assinatura inválida.");
}

export type Entitlement = {
  subscriptionId: string;
  accountId: string;
  product: string;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
  access: "ok" | "warning" | "blocked";
  plan: { code: string; name: string; features: string[]; limits: Record<string, unknown> };
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  account: { name: string; tradeName: string | null; document: string | null; email: string; phone: string | null };
  owner?: { name: string; email: string };
  segment?: string | null;
};

const mirror = (e: Entitlement) => ({ heecaPlan: e.plan.code, heecaStatus: e.status, heecaBlocked: e.access === "blocked", heecaSyncedAt: new Date() });

/**
 * Cria o estabelecimento + dono a partir do portal. Idempotente por subscriptionId.
 * O dono nasce com senha aleatória (entra por SSO; "esqueci a senha" cria uma local se quiser).
 * Um e-mail só pode ser dono de um estabelecimento: se já existir, o provision falha
 * com mensagem clara em vez de vincular silenciosamente a outro tenant.
 */
export async function provision(e: Entitlement) {
  // Marca = produto contratado no portal; se não for uma marca deste motor (contrato antigo), vale a do host.
  const marca = MARCAS[e.product] ?? (await marcaAtual());
  const existing = await db.tenant.findUnique({ where: { heecaSubscriptionId: e.subscriptionId }, select: { id: true, slug: true, marca: true } });
  if (existing) {
    if (existing.marca !== marca.slug) throw new Error(`Assinatura já provisionada no ${MARCAS[existing.marca]?.nome ?? existing.marca}.`);
    await applyEntitlement(e);
    return existing;
  }
  if (!e.owner?.email) throw new Error("owner obrigatório no provision.");
  const email = e.owner.email.trim().toLowerCase();
  const taken = await db.user.findUnique({ where: { email }, select: { tenant: { select: { slug: true, heecaSubscriptionId: true } } } });
  if (taken) throw new Error(`O e-mail ${email} já é usuário do estabelecimento "${taken.tenant.slug}" no ${marca.nome}.`);

  const businessName = e.account.tradeName || e.account.name;
  const slug = await uniqueTenantSlug(businessName);
  const passwordHash = await hashPassword(randomUUID());
  const { tenant } = await db.$transaction((tx) =>
    bootstrapTenant(tx, {
      slug,
      businessName,
      ownerName: e.owner!.name,
      ownerEmail: email,
      passwordHash,
      phone: e.account.phone ? normalizePhone(e.account.phone) : null,
      marca: marca.slug,
      // `segment` do checkout (ex.: ?segment=unhas) já liga o segmento; sem ele o painel pede a escolha.
      segmentos: e.segment && marca.segmentos.some((s) => s.slug === e.segment) ? [e.segment] : [],
      heeca: { subscriptionId: e.subscriptionId, accountId: e.accountId, plan: e.plan.code, status: e.status, blocked: e.access === "blocked" },
    }),
  );
  return { id: tenant.id, slug: tenant.slug, marca: tenant.marca };
}

/** Espelha plano/status/bloqueio vindos do portal. Não cobra, não agenda nada. */
export async function applyEntitlement(e: Entitlement) {
  const tenant = await db.tenant.findUnique({ where: { heecaSubscriptionId: e.subscriptionId }, select: { id: true } });
  if (!tenant) throw new Error("Tenant não provisionado para esta assinatura.");
  await db.tenant.update({ where: { id: tenant.id }, data: mirror(e) });
}

export type SsoClaims = { email: string; name: string; tenantId: string | null; subscriptionId: string; role: string };

/** Valida o JWT emitido pelo portal (HS256, mesmo segredo, aud = slug da marca do host, 60 s). */
export async function verifySsoToken(token: string, marca: Marca): Promise<SsoClaims> {
  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret()), { issuer: "heeca-portal", audience: marca.slug, clockTolerance: 30 }));
  } catch (e) {
    // Mensagens da jose são técnicas ("exp" claim…): o token vale 60 s, então quase sempre é só reabrir pelo portal.
    const code = (e as { code?: string }).code;
    throw new Error(code === "ERR_JWT_EXPIRED" ? "O link de acesso expirou. Volte ao portal Heeca e abra o sistema de novo." : "Link de acesso inválido. Entre pela sua conta Heeca.");
  }
  if (!payload.sub) throw new Error("token sem sub");
  return { email: String(payload.sub).toLowerCase(), name: String(payload.name ?? payload.sub), tenantId: (payload.tenantId as string | null) ?? null, subscriptionId: String(payload.subscriptionId ?? ""), role: String(payload.role ?? "MEMBER") };
}

/**
 * Troca as claims por (userId, tenantId): acha o estabelecimento pela assinatura e o usuário
 * pelo e-mail. Aqui o usuário pertence a um único tenant: se o e-mail existe em outro,
 * recusa (não há "membership" para vincular). Usuário novo: OWNER/ADMIN do portal → OWNER; demais → STAFF.
 * O estabelecimento precisa ser da marca do host (isolamento entre produtos).
 */
export async function resolveSsoUser(c: SsoClaims, marca: Marca) {
  const tenant = c.subscriptionId
    ? await db.tenant.findUnique({ where: { heecaSubscriptionId: c.subscriptionId } })
    : c.tenantId ? await db.tenant.findUnique({ where: { id: c.tenantId } }) : null;
  if (!tenant) throw new Error("Estabelecimento não encontrado para esta assinatura.");
  if (tenant.marca !== marca.slug) throw new Error(`Este estabelecimento é do ${MARCAS[tenant.marca]?.nome ?? tenant.marca}; entre pelo endereço dele.`);
  let user = await db.user.findUnique({ where: { email: c.email } });
  if (user && user.tenantId !== tenant.id) throw new Error(`Este e-mail já é usuário de outro estabelecimento no ${marca.nome}.`);
  if (!user) {
    const role = c.role === "OWNER" || c.role === "ADMIN" ? "OWNER" : "STAFF";
    user = await db.user.create({ data: { tenantId: tenant.id, name: c.name, email: c.email, passwordHash: await hashPassword(randomUUID()), role } });
    if (role === "STAFF") await db.professional.create({ data: { tenantId: tenant.id, userId: user.id, name: c.name } });
  }
  return { userId: user.id, tenantId: tenant.id, slug: tenant.slug };
}

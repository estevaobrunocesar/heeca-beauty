import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { defaultCategories } from "@/lib/services/categories";
import { MARCA_PADRAO, marcaPorSlug, segmentosDe } from "@/lib/marca";

/**
 * Bootstrap de um estabelecimento novo — usado pelo cadastro local (actions/auth) e pelo
 * provisionamento do portal Heeca (lib/heeca). Mantém os dois caminhos idênticos:
 * tenant (marca + segmentos) + categorias sugeridas pelos segmentos + usuário OWNER + profissional
 * vinculado + agenda inicial (seg–sáb 09–18, almoço 12–13).
 */
export type BootstrapInput = {
  slug: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  passwordHash: string;
  phone: string | null;
  /** Marca do host/produto (lib/marca.ts). */
  marca?: string;
  /** Segmentos escolhidos; vazio = ainda não escolheu (o painel pede; categorias de todos entram). */
  segmentos?: string[];
  heeca?: { subscriptionId: string; accountId: string; plan: string; status: string; blocked: boolean };
};

export async function uniqueTenantSlug(base: string) {
  let slug = slugify(base);
  for (let i = 2; await db.tenant.findUnique({ where: { slug } }); i++) slug = `${slugify(base)}-${i}`;
  return slug;
}

export async function bootstrapTenant(tx: Prisma.TransactionClient, input: BootstrapInput) {
  const marca = marcaPorSlug(input.marca ?? MARCA_PADRAO);
  const segmentos = (input.segmentos ?? []).filter((s) => marca.segmentos.some((x) => x.slug === s));
  const tenant = await tx.tenant.create({
    data: {
      slug: input.slug,
      businessName: input.businessName,
      ownerName: input.ownerName,
      phone: input.phone,
      marca: marca.slug,
      segmentos,
      ...(input.heeca
        ? { heecaSubscriptionId: input.heeca.subscriptionId, heecaAccountId: input.heeca.accountId, heecaPlan: input.heeca.plan, heecaStatus: input.heeca.status, heecaBlocked: input.heeca.blocked, heecaSyncedAt: new Date() }
        : {}),
    },
  });
  const user = await tx.user.create({
    data: { tenantId: tenant.id, name: input.ownerName, email: input.ownerEmail, passwordHash: input.passwordHash, role: "OWNER" },
  });
  const professional = await tx.professional.create({
    data: { tenantId: tenant.id, userId: user.id, name: input.ownerName },
  });
  await tx.serviceCategory.createMany({ data: categoriasParaCriar(tenant.id, defaultCategories(segmentosDe(marca, tenant))) });
  await tx.availabilityRule.createMany({
    data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
      tenantId: tenant.id,
      professionalId: professional.id,
      weekday,
      startMinutes: 9 * 60,
      endMinutes: 18 * 60,
      breakStartMinutes: 12 * 60,
      breakEndMinutes: 13 * 60,
    })),
  });
  return { tenant, user, professional };
}

const categoriasParaCriar = (tenantId: string, lista: { slug: string; name: string }[], apartirDe = 0) =>
  lista.map((c, i) => ({ tenantId, name: c.name, slug: c.slug, sortOrder: apartirDe + i }));

/**
 * Ao ligar segmentos nas configurações, cria as categorias sugeridas que ainda não existem
 * (por slug). Nunca apaga nem renomeia: categorias são do salão.
 */
export async function garantirCategoriasDosSegmentos(tx: Prisma.TransactionClient, tenant: { id: string; marca: string; segmentos: string[] }) {
  const marca = marcaPorSlug(tenant.marca);
  const sugeridas = defaultCategories(segmentosDe(marca, tenant));
  const existentes = await tx.serviceCategory.findMany({ where: { tenantId: tenant.id }, select: { slug: true, sortOrder: true } });
  const slugs = new Set(existentes.map((c) => c.slug));
  const novas = sugeridas.filter((c) => !slugs.has(c.slug));
  if (novas.length === 0) return 0;
  const proximo = existentes.reduce((m, c) => Math.max(m, c.sortOrder + 1), 0);
  await tx.serviceCategory.createMany({ data: categoriasParaCriar(tenant.id, novas, proximo) });
  return novas.length;
}

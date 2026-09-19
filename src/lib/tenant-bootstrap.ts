import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

/**
 * Bootstrap de um estabelecimento novo — usado pelo cadastro local (actions/auth) e pelo
 * provisionamento do portal Heeca (lib/heeca). Mantém os dois caminhos idênticos:
 * tenant + usuário OWNER + profissional vinculado + agenda inicial (seg–sáb 09–18, almoço 12–13).
 */
export type BootstrapInput = {
  slug: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  passwordHash: string;
  phone: string | null;
  heeca?: { subscriptionId: string; accountId: string; plan: string; status: string; blocked: boolean };
};

export async function uniqueTenantSlug(base: string) {
  let slug = slugify(base);
  for (let i = 2; await db.tenant.findUnique({ where: { slug } }); i++) slug = `${slugify(base)}-${i}`;
  return slug;
}

export async function bootstrapTenant(tx: Prisma.TransactionClient, input: BootstrapInput) {
  const tenant = await tx.tenant.create({
    data: {
      slug: input.slug,
      businessName: input.businessName,
      ownerName: input.ownerName,
      phone: input.phone,
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

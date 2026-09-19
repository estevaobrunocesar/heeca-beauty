import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import type { Professional } from "@/generated/prisma/client";

const COOKIE_NAME = "heeca_session";
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET não configurado (mínimo 16 caracteres)");
  return new TextEncoder().encode(s);
}

export type SessionPayload = { userId: string; tenantId: string };

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string" || typeof payload.tenantId !== "string") return null;
    return { userId: payload.userId, tenantId: payload.tenantId };
  } catch {
    return null;
  }
}

/**
 * Contexto autenticado usado por todas as páginas e actions do painel.
 * Garante o isolamento multi-tenant: tudo que o painel faz parte de `tenant.id`.
 *
 * Permissões:
 *  - OWNER: vê e gerencia todos os profissionais (`professionals`).
 *  - STAFF: vê apenas o próprio profissional (`professional`); `professionals` contém só ele.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { tenant: true, professional: true },
  });
  if (!user || user.tenantId !== session.tenantId) {
    await destroySession();
    redirect("/login");
  }
  // Assinatura bloqueada no portal Heeca (inadimplência/cancelamento): painel fecha, página pública segue.
  if (user.tenant.heecaBlocked) redirect("/bloqueado");

  const isOwner = user.role === "OWNER";
  const all = await db.professional.findMany({
    where: { tenantId: user.tenantId, ...(isOwner ? {} : { id: user.professional?.id ?? "__none__" }) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (all.length === 0) throw new Error("Tenant sem profissional cadastrado");

  // "Profissional padrão" do usuário: o próprio (se vinculado) ou o primeiro da equipe.
  const professional = user.professional ?? all[0];

  return { user, tenant: user.tenant, professional, professionals: all, isOwner };
}

export type AuthContext = Awaited<ReturnType<typeof requireAuth>>;

/** Profissionais ativos que o usuário pode operar. */
export function activeProfessionals(ctx: AuthContext): Professional[] {
  return ctx.professionals.filter((p) => p.active);
}

/** Garante que o usuário pode agir sobre este profissional; lança se não puder. */
export function requireProfessionalAccess(ctx: AuthContext, professionalId: string): Professional {
  const p = ctx.professionals.find((x) => x.id === professionalId);
  if (!p) throw new Error("Sem permissão para este profissional");
  return p;
}

/** Resolve o profissional de uma ação a partir de um id opcional (padrão: o do usuário). */
export function resolveProfessional(ctx: AuthContext, professionalId?: string | null): Professional {
  return professionalId ? requireProfessionalAccess(ctx, professionalId) : ctx.professional;
}

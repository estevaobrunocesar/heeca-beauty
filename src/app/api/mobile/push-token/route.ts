import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { PLATAFORMAS, tokenValido } from "@/lib/push/rules";

export const dynamic = "force-dynamic";

const body = z.object({ token: z.string(), platform: z.enum(PLATAFORMAS) });

/** O app registra aqui o token do aparelho logo depois do login. Um aparelho pertence a quem entrou por último nele. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !tokenValido(parsed.data.token)) return Response.json({ ok: false }, { status: 400 });
  const { token, platform } = parsed.data;
  const user = await db.user.findFirst({ where: { id: session.userId, tenantId: session.tenantId }, select: { id: true } });
  if (!user) return Response.json({ ok: false }, { status: 401 });
  await db.deviceToken.upsert({
    where: { token },
    create: { token, platform, userId: user.id, tenantId: session.tenantId },
    update: { platform, userId: user.id, tenantId: session.tenantId, lastSeenAt: new Date() },
  });
  return Response.json({ ok: true });
}

/** Saída da conta no aparelho: para de avisar a quem saiu. */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });
  const parsed = z.object({ token: z.string() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  await db.deviceToken.deleteMany({ where: { token: parsed.data.token, userId: session.userId } });
  return Response.json({ ok: true });
}

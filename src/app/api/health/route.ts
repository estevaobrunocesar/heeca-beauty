import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + readiness (healthcheck do Docker/Coolify): o banco responde? */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up" });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}

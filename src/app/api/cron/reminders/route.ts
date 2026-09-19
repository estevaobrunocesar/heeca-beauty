import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendDueReminders } from "@/lib/appointments/service";

/** Envia lembretes. Agende a cada 15–30 min (Vercel Cron, GitHub Actions, cron do servidor...). */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const sent = await sendDueReminders();
  return NextResponse.json({ ok: true, sent });
}

import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { expirePendingAppointments } from "@/lib/appointments/service";

/** Libera horários de agendamentos não confirmados no prazo. Agende a cada 5–10 min. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const released = await expirePendingAppointments();
  return NextResponse.json({ ok: true, released });
}

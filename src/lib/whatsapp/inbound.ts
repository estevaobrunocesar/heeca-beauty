import "server-only";
import { db } from "@/lib/db";
import { AppointmentError, cancelByToken, confirmByToken, requestRescheduleByToken } from "@/lib/appointments/service";
import type { InboundEvent } from "@/lib/whatsapp/provider";

/** Processa um evento recebido do WhatsApp (independente do provedor). */
export async function handleEvent(ev: InboundEvent) {
  if (ev.type === "status") {
    const map = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" } as const;
    await db.whatsappMessage.updateMany({
      where: { providerMessageId: ev.providerMessageId },
      data: { status: map[ev.status], ...(ev.error ? { error: ev.error } : {}) },
    });
    return;
  }

  if (ev.type === "button_reply") {
    const [action, token] = ev.buttonId.split(":");
    if (!token) return;
    await logInbound(ev.from, ev.buttonId, ev.providerMessageId, token);
    try {
      if (action === "confirm") await confirmByToken(token);
      else if (action === "cancel") await cancelByToken(token);
      else if (action === "reschedule") await requestRescheduleByToken(token);
    } catch (e) {
      if (!(e instanceof AppointmentError)) throw e;
      // Regra de negócio negou (ex.: fora do prazo). Já registrado; nada a fazer.
    }
    return;
  }

  if (ev.type === "text") {
    // Cliente respondeu "sim"/"confirmar" em texto livre: tenta casar com o último pendente do número.
    const text = ev.text.trim().toLowerCase();
    const pending = await db.appointment.findFirst({
      where: { client: { phone: ev.from }, status: { in: ["PENDING", "AWAITING_CONFIRMATION", "CONFIRMED"] }, startsAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    await logInbound(ev.from, ev.text, ev.providerMessageId, pending?.confirmationToken);
    if (!pending) return;
    if (/^(sim|s|confirmo|confirmar|ok|1)\b/.test(text)) await confirmByToken(pending.confirmationToken);
    else if (/^(n[aã]o|n|cancelar|cancela|2)\b/.test(text)) {
      try { await cancelByToken(pending.confirmationToken); } catch (e) { if (!(e instanceof AppointmentError)) throw e; }
    }
  }
}

async function logInbound(phone: string, body: string, providerMessageId: string, token?: string) {
  const appt = token ? await db.appointment.findUnique({ where: { confirmationToken: token }, select: { id: true, tenantId: true, clientId: true } }) : null;
  if (!appt) return;
  await db.whatsappMessage.create({
    data: { tenantId: appt.tenantId, appointmentId: appt.id, clientId: appt.clientId, direction: "INBOUND", kind: "INBOUND", phone, body, providerMessageId, status: "DELIVERED" },
  }).catch(() => { /* providerMessageId duplicado em reentrega: ignora */ });
}

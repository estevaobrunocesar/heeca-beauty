import "server-only";
import { db } from "@/lib/db";
import { fmtDate, fmtTime, toDateKey, addDaysToKey } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { paymentPageUrl } from "@/lib/payments/service";
import { describeBooking } from "@/lib/services/addons";
import { getWhatsappProvider } from "./index";
import { DEFAULT_TEMPLATES, renderTemplate } from "./templates";
import type { QuickReplyButton, TemplateMessage } from "./provider";
import {
  META_TEMPLATES, metaTemplateLanguage, metaTemplateName, metaTemplatesEnabled, renderMetaBody,
  type MessageVars, type OutboundKind,
} from "./meta-templates";

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function confirmationUrl(token: string) {
  return `${appUrl()}/confirmar/${token}`;
}

export function publicBookingUrl(slug: string) {
  return `${appUrl()}/agendar/${slug}`;
}

/**
 * Envia (e registra) uma mensagem de WhatsApp relativa a um agendamento.
 * Nunca lança: falhas ficam registradas em WhatsappMessage.status = FAILED,
 * para que o agendamento em si nunca seja perdido por problema no provedor.
 */
export async function sendAppointmentMessage(appointmentId: string, kind: OutboundKind) {
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { tenant: { include: { templates: true } }, client: true, professional: true, addOns: { select: { name: true } } },
  });
  if (!appt) return null;

  const { tenant, client } = appt;
  const payment = await db.payment.findUnique({ where: { appointmentId: appt.id } });
  const tz = tenant.timezone;

  const todayKey = toDateKey(new Date(), tz);
  const apptKey = toDateKey(appt.startsAt, tz);
  const quando =
    apptKey === todayKey ? "hoje" : apptKey === addDaysToKey(todayKey, 1) ? "amanhã" : `dia ${fmtDate(appt.startsAt, tz)}`;

  // Orientações pré-atendimento (seção 8.4): entram nas mensagens de confirmação/lembrete.
  const orientacoes = tenant.preServiceInstructions?.trim() ? `${tenant.preServiceInstructions.trim()}\n\n` : "";

  const vars: MessageVars = {
    cliente: client.name.split(" ")[0],
    servico: describeBooking(appt.serviceName, appt.addOns.map((a) => a.name)),
    orientacoes,
    profissional: appt.professional.name,
    estabelecimento: tenant.businessName,
    data: fmtDate(appt.startsAt, tz),
    hora: fmtTime(appt.startsAt, tz),
    quando,
    link: confirmationUrl(appt.confirmationToken),
    link_agenda: publicBookingUrl(tenant.slug),
    token: appt.confirmationToken,
    slug: tenant.slug,
    valor_sinal: payment ? formatCents(payment.amountCents) : "",
    prazo_pagamento: `${tenant.depositTimeoutMinutes} minutos`,
    link_pagamento: paymentPageUrl(appt.confirmationToken),
  };

  const provider = getWhatsappProvider();
  const useTemplate = metaTemplatesEnabled() && typeof provider.sendTemplate === "function";

  // Corpo registrado no histórico: o template da Meta ou o texto editável do tenant.
  const body = useTemplate
    ? renderMetaBody(kind, vars)
    : renderTemplate(tenant.templates.find((t) => t.kind === kind)?.body ?? DEFAULT_TEMPLATES[kind], vars);

  const record = await db.whatsappMessage.create({
    data: { tenantId: tenant.id, appointmentId: appt.id, clientId: client.id, direction: "OUTBOUND", kind, phone: client.phone, body },
  });

  try {
    let result;
    if (useTemplate) {
      const spec = META_TEMPLATES[kind];
      const message: TemplateMessage = {
        to: client.phone,
        name: metaTemplateName(kind),
        language: metaTemplateLanguage(),
        bodyParams: spec.params.map((p) => vars[p] || " "),
        buttons: spec.buttons?.map((b) =>
          b.type === "quick_reply" ? { type: "quick_reply", payload: b.payload(vars) } : { type: "url", text: b.suffix(vars) },
        ),
        body,
      };
      result = await provider.sendTemplate!(message);
    } else {
      const buttons: QuickReplyButton[] | undefined =
        kind === "REQUEST_CONFIRMATION"
          ? [
              { id: `confirm:${appt.confirmationToken}`, title: "Confirmar" },
              { id: `reschedule:${appt.confirmationToken}`, title: "Remarcar" },
              { id: `cancel:${appt.confirmationToken}`, title: "Cancelar" },
            ]
          : kind === "REMINDER"
            ? [
                { id: `reschedule:${appt.confirmationToken}`, title: "Remarcar" },
                { id: `cancel:${appt.confirmationToken}`, title: "Cancelar" },
              ]
            : undefined;
      result = await provider.send({ to: client.phone, body, buttons });
    }
    await db.whatsappMessage.update({
      where: { id: record.id },
      data: { status: "SENT", providerMessageId: result.providerMessageId ?? null },
    });
    return { ok: true as const, messageId: record.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp] falha ao enviar ${kind} para ${client.phone}:`, error);
    await db.whatsappMessage.update({ where: { id: record.id }, data: { status: "FAILED", error } });
    return { ok: false as const, error };
  }
}

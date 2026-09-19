import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppointmentError, createAppointment, MAX_ITEMS_PER_VISIT } from "@/lib/appointments/service";
import { describeProfessionals } from "@/lib/appointments/summary";
import { hasPolicies } from "@/lib/policies";

const itemSchema = z.object({
  serviceId: z.string().min(1),
  professionalId: z.string().min(1).optional().nullable(), // null/omitido = qualquer profissional
  addOnIds: z.array(z.string().min(1)).max(10).optional(),
});

const bodySchema = z.object({
  // Visita com vários serviços (SPEC §11). Os campos soltos abaixo são o atalho de um único item.
  items: z.array(itemSchema).min(1).max(MAX_ITEMS_PER_VISIT).optional(),
  serviceId: z.string().min(1).optional(),
  addOnIds: z.array(z.string().min(1)).max(10).optional(),
  professionalId: z.string().min(1).optional().nullable(),
  acceptPolicies: z.boolean().optional(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().int().min(0).max(1439),
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  phone: z.string().trim().min(8, "Informe seu WhatsApp"),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

// Limite simples por IP para evitar spam de agendamentos (em memória; use Redis em produção com várias instâncias).
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string, limit = 10, windowMs = 10 * 60_000) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.resetAt < now) { hits.set(ip, { count: 1, resetAt: now + windowMs }); return false; }
  h.count++;
  return h.count > limit;
}

export async function POST(req: Request, { params }: RouteContext<"/api/public/[slug]/book">) {
  const { slug } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const d = parsed.data;
  const items = d.items ?? (d.serviceId ? [{ serviceId: d.serviceId, professionalId: d.professionalId ?? null, addOnIds: d.addOnIds ?? [] }] : []);
  if (items.length === 0) return NextResponse.json({ ok: false, error: "Escolha ao menos um serviço." }, { status: 400 });

  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ ok: false, error: "Estabelecimento não encontrado" }, { status: 404 });
  // Seção 5, passo 8: a cliente precisa aceitar as políticas quando a profissional exige.
  if (tenant.requirePolicyAcceptance && hasPolicies(tenant) && !d.acceptPolicies) {
    return NextResponse.json({ ok: false, error: "Você precisa aceitar as políticas de atendimento para agendar." }, { status: 400 });
  }

  try {
    const appt = await createAppointment({
      tenant,
      items,
      dateKey: d.dateKey,
      minutes: d.minutes,
      client: { name: d.name, phone: d.phone, email: d.email || null },
      notes: d.notes || null,
      source: "PUBLIC",
      actor: "CLIENT",
    });
    // Status pode ter avançado para AWAITING_CONFIRMATION após o envio do WhatsApp.
    const fresh = await db.appointment.findUnique({ where: { id: appt.id }, select: { status: true, items: { orderBy: { sortOrder: "asc" }, select: { professional: { select: { name: true } } } }, payment: { select: { amountCents: true } } } });
    return NextResponse.json({
      ok: true,
      id: appt.id,
      status: fresh?.status ?? appt.status,
      professionalName: fresh ? describeProfessionals(fresh.items) : undefined,
      // Sinal pendente: o front leva o cliente para a página do Pix
      paymentUrl: fresh?.status === "AWAITING_PAYMENT" ? `/pagar/${appt.confirmationToken}` : null,
      depositCents: fresh?.payment?.amountCents ?? null,
    });
  } catch (e) {
    if (e instanceof AppointmentError) return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: 409 });
    console.error("[book]", e);
    return NextResponse.json({ ok: false, error: "Erro inesperado. Tente novamente." }, { status: 500 });
  }
}

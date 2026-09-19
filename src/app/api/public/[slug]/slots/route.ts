import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getDaysWithVisitAvailability, getVisitSlots } from "@/lib/scheduling/service";
import type { VisitItem } from "@/lib/scheduling/availability";
import { AppointmentError, resolveVisitItems, type CreateItemInput } from "@/lib/appointments/service";
import { addDaysToKey, todayKey } from "@/lib/dates";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const itemsSchema = z.array(z.object({
  serviceId: z.string().min(1),
  professionalId: z.string().min(1).optional().nullable(),
  addOnIds: z.array(z.string().min(1)).max(10).optional(),
})).min(1).max(6);

/**
 * GET /api/public/[slug]/slots?date=YYYY-MM-DD&items=<json>              → horários do dia
 * GET /api/public/[slug]/slots?from=YYYY-MM-DD&to=YYYY-MM-DD&items=<json> → dias com vaga
 *
 * `items` é um JSON `[{ serviceId, professionalId?, addOnIds? }, …]` na ordem da visita (SPEC §11).
 * `professionalId` omitido = qualquer profissional habilitado (SPEC §10).
 *
 * Atalhos:
 *  - serviceId=&professionalId=&addOns=a,b → visita de um único item
 *  - exclude=<apptId>                      → reagendamento: itens vêm do próprio agendamento, que é ignorado no cálculo
 */
export async function GET(req: Request, { params }: RouteContext<"/api/public/[slug]/slots">) {
  const { slug } = await params;
  const url = new URL(req.url);
  const q = (k: string) => url.searchParams.get(k);
  const headers = { "Cache-Control": "no-store" };

  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let items: VisitItem[];
  const exclude = q("exclude") ?? undefined;
  try {
    if (exclude) {
      const appt = await db.appointment.findFirst({ where: { id: exclude, tenantId: tenant.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
      if (!appt) return NextResponse.json({ error: "appointment_not_found" }, { status: 404 });
      items = appt.items.map((it) => ({ key: it.id, durationMinutes: it.durationMinutes, candidates: [it.professionalId] }));
    } else {
      let inputs: CreateItemInput[];
      if (q("items")) {
        const parsed = itemsSchema.safeParse(JSON.parse(q("items")!));
        if (!parsed.success) return NextResponse.json({ error: "bad_items" }, { status: 400 });
        inputs = parsed.data;
      } else if (q("serviceId")) {
        inputs = [{ serviceId: q("serviceId")!, professionalId: q("professionalId"), addOnIds: q("addOns")?.split(",").filter(Boolean) }];
      } else {
        return NextResponse.json({ error: "bad_request" }, { status: 400 });
      }
      items = (await resolveVisitItems(tenant.id, inputs)).map((r) => r.visitItem);
    }
  } catch (e) {
    if (e instanceof AppointmentError) return NextResponse.json({ error: e.code, message: e.message }, { status: 404 });
    if (e instanceof SyntaxError) return NextResponse.json({ error: "bad_items" }, { status: 400 });
    throw e;
  }

  if (q("from") && q("to")) {
    const from = q("from")!;
    const to = q("to")!;
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from || addDaysToKey(from, 62) < to) {
      return NextResponse.json({ error: "bad_range" }, { status: 400 });
    }
    const days = await getDaysWithVisitAvailability({ tenant, items, fromKey: from, toKey: to });
    return NextResponse.json({ days: [...days] }, { headers });
  }

  const date = q("date") ?? todayKey(tenant.timezone);
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "bad_date" }, { status: 400 });

  const slots = await getVisitSlots({ tenant, items, dateKey: date, excludeAppointmentId: exclude });
  return NextResponse.json(
    {
      date,
      slots: slots.map((s) => ({
        minutes: s.minutes,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        // Compatibilidade com o seletor de um item: profissional do primeiro item.
        professionalId: s.placements[0]?.professionalId,
        placements: s.placements,
      })),
    },
    { headers },
  );
}

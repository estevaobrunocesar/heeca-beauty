import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailableSlots, getAvailableSlotsAny, getDaysWithAvailability, getDaysWithAvailabilityAny } from "@/lib/scheduling/service";
import { addDaysToKey, todayKey } from "@/lib/dates";
import { computeBookingTotals, normalizeAddOnIds } from "@/lib/services/addons";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/public/[slug]/slots?date=YYYY-MM-DD&serviceId=...              → horários do dia
 * GET /api/public/[slug]/slots?from=YYYY-MM-DD&to=YYYY-MM-DD&serviceId=... → dias com vaga
 *
 * Opcionais:
 *  - professionalId=<id>  → só este profissional (omitido = qualquer profissional que faça o serviço)
 *  - addOns=id1,id2       → adicionais (somam à duração do serviço)
 *  - duration=30          → no lugar de serviceId (ex.: reagendamento)
 *  - exclude=<apptId>     → ignora este agendamento (reagendamento)
 */
export async function GET(req: Request, { params }: RouteContext<"/api/public/[slug]/slots">) {
  const { slug } = await params;
  const url = new URL(req.url);
  const q = (k: string) => url.searchParams.get(k);

  const tenant = await db.tenant.findUnique({
    where: { slug },
    include: { professionals: { where: { active: true }, orderBy: { sortOrder: "asc" }, include: { services: { select: { serviceId: true } } } } },
  });
  if (!tenant || tenant.professionals.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let durationMinutes = Number(q("duration"));
  let eligible = tenant.professionals;
  if (q("serviceId")) {
    const svc = await db.service.findFirst({ where: { id: q("serviceId")!, tenantId: tenant.id, active: true, deletedAt: null } });
    if (!svc) return NextResponse.json({ error: "service_not_found" }, { status: 404 });
    durationMinutes = svc.durationMinutes;
    eligible = eligible.filter((p) => p.services.some((s) => s.serviceId === svc.id));
    // Adicionais alteram a duração total e, portanto, quais horários cabem no dia.
    const addOnIds = normalizeAddOnIds(q("addOns")?.split(","));
    if (addOnIds.length) {
      const addOns = await db.service.findMany({ where: { id: { in: addOnIds }, tenantId: tenant.id, active: true, deletedAt: null, isAddOn: true } });
      durationMinutes = computeBookingTotals(svc, addOns).durationMinutes;
    }
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const professionalId = q("professionalId");
  if (professionalId) {
    if (!eligible.some((p) => p.id === professionalId)) return NextResponse.json({ error: "professional_not_found" }, { status: 404 });
    eligible = eligible.filter((p) => p.id === professionalId);
  }
  const ids = eligible.map((p) => p.id);
  const exclude = q("exclude") ?? undefined;
  const headers = { "Cache-Control": "no-store" };

  if (q("from") && q("to")) {
    const from = q("from")!;
    const to = q("to")!;
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from || addDaysToKey(from, 62) < to) {
      return NextResponse.json({ error: "bad_range" }, { status: 400 });
    }
    const days = ids.length === 1
      ? await getDaysWithAvailability({ tenant, professionalId: ids[0], fromKey: from, toKey: to, durationMinutes })
      : await getDaysWithAvailabilityAny({ tenant, professionalIds: ids, fromKey: from, toKey: to, durationMinutes });
    return NextResponse.json({ days: [...days] }, { headers });
  }

  const date = q("date") ?? todayKey(tenant.timezone);
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "bad_date" }, { status: 400 });

  const slots = ids.length === 1
    ? (await getAvailableSlots({ tenant, professionalId: ids[0], dateKey: date, durationMinutes, excludeAppointmentId: exclude })).map((s) => ({ ...s, professionalId: ids[0] }))
    : await getAvailableSlotsAny({ tenant, professionalIds: ids, dateKey: date, durationMinutes });

  return NextResponse.json(
    { date, slots: slots.map((s) => ({ minutes: s.minutes, startsAt: s.startsAt.toISOString(), professionalId: s.professionalId })) },
    { headers },
  );
}

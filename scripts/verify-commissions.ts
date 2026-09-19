/**
 * Verificação local da apuração de comissão (SPEC §17) contra o banco de dev.
 *   npx tsx --conditions react-server --env-file=.env scripts/verify-commissions.ts
 * Conclui a visita de hoje da Maria (seed) e imprime a comissão de cada item.
 */
import { db } from "../src/lib/db";
import { transition } from "../src/lib/appointments/service";

async function main() {
  const appt = await db.appointment.findFirst({
    where: { client: { name: "Maria Oliveira" }, status: "CONFIRMED", items: { some: { professional: { name: "Mariana" } } } },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { professional: true } } },
  });
  if (!appt) throw new Error("visita da seed não encontrada (rode o seed)");
  await transition({ appointmentId: appt.id, tenantId: appt.tenantId, actor: "PROFESSIONAL", to: "COMPLETED", notify: false });
  const after = await db.appointmentItem.findMany({ where: { appointmentId: appt.id }, orderBy: { sortOrder: "asc" }, include: { professional: { select: { name: true, commissionPercent: true } } } });
  for (const it of after) console.log(`${it.serviceName.padEnd(28)} ${it.professional.name.padEnd(8)} ${String(it.professional.commissionPercent ?? "—").padStart(3)}%  preço ${it.priceCents}  comissão ${it.commissionCents ?? "null"}`);
  // Reabre para não sujar a seed
  await transition({ appointmentId: appt.id, tenantId: appt.tenantId, actor: "PROFESSIONAL", to: "CONFIRMED", notify: false });
  const reopened = await db.appointmentItem.findMany({ where: { appointmentId: appt.id }, select: { commissionCents: true } });
  console.log("após reabrir:", reopened.map((r) => r.commissionCents));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());

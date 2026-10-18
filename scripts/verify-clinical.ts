/**
 * Verificação local do módulo clínico contra o banco de dev (camada de serviço, sem navegador):
 *   npx tsx --conditions react-server --env-file=.env scripts/verify-clinical.ts
 * Cria protocolo + plano de protocolo, agenda visitas e confere vínculo por escopo, consumo e saldo.
 * Idempotente: usa o prefixo "VERIF " e limpa o que criou no fim (também se falhar).
 */
import { db } from "../src/lib/db";
import { createAppointment, transition } from "../src/lib/appointments/service";
import { progressoDe, regraFaltaDe } from "../src/lib/packages/service";

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => { results.push([name, ok, detail]); console.log(`${ok ? "✔" : "✖"} ${name}${detail ? ` — ${detail}` : ""}`); };

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "salao-bela-vista" } });
  const mariana = await db.professional.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Mariana" } });
  const ana = await db.professional.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Ana" } });
  // Dois serviços de Mariana (etapas do protocolo) e um que NÃO é etapa
  const [sobrancelha, manicure, gel] = await Promise.all(["Design de sobrancelhas", "Manicure", "Esmaltação em gel"].map((name) => db.service.findFirstOrThrow({ where: { tenantId: tenant.id, name, isAddOn: false } })));
  const client = await db.client.create({ data: { tenantId: tenant.id, name: "VERIF Cliente", phone: "+5511900000001" } });

  // 1. Protocolo com 2 etapas
  const protocol = await db.protocol.create({
    data: { tenantId: tenant.id, name: "VERIF Protocolo", sessionsCount: 3, intervalDays: 10, steps: { create: [{ serviceId: sobrancelha.id, order: 1 }, { serviceId: manicure.id, order: 2 }] } },
    include: { steps: true },
  });
  check("protocolo criado com etapas ordenadas", protocol.steps.length === 2);

  // 2. Avaliação → plano de protocolo (3 sessões) ligado à avaliação
  const assessment = await db.assessment.create({ data: { tenantId: tenant.id, clientId: client.id, professionalId: ana.id, performedAt: new Date(), complaints: "VERIF queixa", recommendedProtocolId: protocol.id, suggestedSessions: 3 } });
  const plan = await db.clientPackage.create({
    data: { tenantId: tenant.id, clientId: client.id, protocolId: protocol.id, assessmentId: assessment.id, professionalId: ana.id, intervalDays: 10, name: "VERIF Plano", sessionsTotal: 3, startsAt: new Date(), priceCents: 30000 },
  });
  check("plano ligado à avaliação", (await db.assessment.findUnique({ where: { id: assessment.id }, include: { plan: true } }))?.plan?.id === plan.id);

  const regra = regraFaltaDe(tenant);
  const tz = tenant.timezone;
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString("sv-SE", { timeZone: tz });
  // Procura o primeiro dia/horário em que o serviço cabe (os horários dependem da agenda de hoje)
  const { getVisitSlots } = await import("../src/lib/scheduling/service");
  async function agendar(service: { id: string }, professionalId: string) {
    for (let off = 3; off < 30; off++) {
      const dateKey = day(off);
      const slots = await getVisitSlots({ tenant, items: [{ key: "0", durationMinutes: (await db.service.findUniqueOrThrow({ where: { id: service.id } })).durationMinutes, candidates: [professionalId] }], dateKey });
      if (slots[0]) return createAppointment({ tenant, items: [{ serviceId: service.id, professionalId }], dateKey, minutes: slots[0].minutes, client: { name: "VERIF Cliente", phone: "+5511900000001" }, source: "DASHBOARD", actor: "PROFESSIONAL" });
    }
    throw new Error("sem horário livre nos próximos 30 dias");
  }

  // 3. Visita com etapa do protocolo → vincula sozinha e reserva a sessão
  const a1 = await agendar(sobrancelha, mariana.id);
  const s1 = await db.packageSession.findFirst({ where: { item: { appointmentId: a1.id } } });
  check("serviço que é etapa do protocolo vincula ao plano", s1?.clientPackageId === plan.id && s1?.status === "SCHEDULED");
  let prog = await progressoDe(tenant.id, plan.id, regra);
  check("saldo: 0 usadas, 1 agendada, 2 livres", prog?.usadas === 0 && prog?.agendadas === 1 && prog?.disponiveis === 2, JSON.stringify(prog));

  // 4. Serviço fora do protocolo NÃO vincula
  const a2 = await agendar(gel, mariana.id);
  check("serviço fora do protocolo não consome o plano", (await db.packageSession.count({ where: { item: { appointmentId: a2.id } } })) === 0);

  // 5. Concluir → consome; evolução fica gravada na sessão
  await transition({ appointmentId: a1.id, tenantId: tenant.id, actor: "PROFESSIONAL", to: "CONFIRMED", notify: false }).catch(() => {});
  await transition({ appointmentId: a1.id, tenantId: tenant.id, actor: "PROFESSIONAL", to: "COMPLETED", notify: false });
  prog = await progressoDe(tenant.id, plan.id, regra);
  check("concluir debita 1 sessão (restam 2)", prog?.usadas === 1 && prog?.restantes === 2, JSON.stringify(prog));
  const done = await db.packageSession.findFirstOrThrow({ where: { clientPackageId: plan.id, status: "DONE" } });
  await db.packageSession.update({ where: { id: done.id }, data: { productsUsed: "VERIF ácido", evolution: "VERIF pele respondeu bem" } });
  check("evolução gravada na sessão realizada", (await db.packageSession.findUnique({ where: { id: done.id } }))?.evolution === "VERIF pele respondeu bem");

  // 6. Comissão continua sendo apurada por item (o módulo clínico não a quebra)
  const item = await db.appointmentItem.findFirstOrThrow({ where: { appointmentId: a1.id } });
  check("comissão apurada no item concluído (Mariana 50%)", item.commissionCents === Math.round(item.priceCents * 0.5), `${item.commissionCents} de ${item.priceCents}`);

  // 7. Recebimentos: 2 parcelas
  await db.clientPackagePayment.createMany({ data: [{ tenantId: tenant.id, clientPackageId: plan.id, amountCents: 10000, method: "PIX" }, { tenantId: tenant.id, clientPackageId: plan.id, amountCents: 5000, method: "CASH" }] });
  const { resumoPagamentos } = await import("../src/lib/treatments/rules");
  const pays = await db.clientPackagePayment.findMany({ where: { clientPackageId: plan.id } });
  const r = resumoPagamentos(plan.priceCents, pays);
  check("recebimentos: pago 150, falta 150", r.pagoCents === 15000 && r.saldoCents === 15000 && !r.quitado, JSON.stringify(r));

  // 8. Excluir a avaliação mantém o plano (assessmentId vira null)
  await db.assessment.delete({ where: { id: assessment.id } });
  check("excluir avaliação mantém o plano", (await db.clientPackage.findUnique({ where: { id: plan.id } }))?.assessmentId === null);

  console.log(`\n${results.filter((x) => x[1]).length}/${results.length} verificações ok`);
  if (results.some((x) => !x[1])) process.exitCode = 1;

  // limpeza
  await cleanup(tenant.id, client.id, protocol.id);
}

async function cleanup(tenantId: string, clientId: string, protocolId: string) {
  const appts = await db.appointment.findMany({ where: { clientId }, select: { id: true } });
  await db.appointmentEvent.deleteMany({ where: { appointmentId: { in: appts.map((a) => a.id) } } });
  await db.whatsappMessage.deleteMany({ where: { clientId } });
  await db.appointment.deleteMany({ where: { clientId } }); // itens e sessões saem em cascata/SetNull
  await db.clientPackage.deleteMany({ where: { clientId } });
  await db.assessment.deleteMany({ where: { clientId } });
  await db.protocol.deleteMany({ where: { id: protocolId, tenantId } });
  await db.client.deleteMany({ where: { id: clientId } });
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  const c = await db.client.findFirst({ where: { phone: "+5511900000001" } });
  const p = await db.protocol.findFirst({ where: { name: "VERIF Protocolo" } });
  if (c && p) await cleanup(p.tenantId, c.id, p.id).catch(() => {});
}).finally(() => db.$disconnect());

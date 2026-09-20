/**
 * Seed de desenvolvimento: cria um salão de beleza de exemplo com categorias, serviços por categoria,
 * adicionais, três profissionais com especialidades diferentes, portfólio, políticas, clientes e
 * visitas com vários serviços (SPEC §11).
 * Logins: demo@heeca.app / demo1234 (responsável) · mariana@heeca.app / mari1234 (profissional STAFF)
 */
import "dotenv/config";
import { PrismaClient, type Service } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { fromZonedTime } from "date-fns-tz";
import { addDays, format, set } from "date-fns";
import { defaultCategories } from "../src/lib/services/categories";
import { MARCAS, segmentosDe } from "../src/lib/marca";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const TZ = "America/Sao_Paulo";
const SLUG = "salao-bela-vista";

function at(daysFromNow: number, hh: number, mm = 0) {
  const local = set(addDays(new Date(), daysFromNow), { hours: hh, minutes: mm, seconds: 0, milliseconds: 0 });
  return fromZonedTime(format(local, "yyyy-MM-dd'T'HH:mm:ss"), TZ);
}

async function main() {
  const existing = await db.tenant.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Seed já aplicado (tenant ${SLUG} existe). Nada a fazer.`);
    return;
  }

  const tenant = await db.tenant.create({
    data: {
      slug: SLUG,
      marca: "beauty",
      segmentos: ["cabelo", "unhas", "sobrancelhas"],
      businessName: "Salão Bela Vista",
      ownerName: "Ana Ribeiro",
      description: "Cabelo, unhas, sobrancelhas e barbearia no mesmo lugar. Agende vários serviços numa única visita e saia pronta.",
      phone: "+5511999990000",
      address: "Rua das Acácias, 45",
      city: "Santo André - SP",
      instagram: "salaobelavista",
      pendingExpiryMinutes: 120,
      bufferMinutes: 10,
      lateToleranceMinutes: 15,
      cancellationPolicy: "Cancelamentos com menos de 24h de antecedência podem ter o sinal retido. Avise pelo WhatsApp o quanto antes.",
      reschedulePolicy: "Reagendamentos até 12h antes do horário, sujeitos à disponibilidade.",
      noShowPolicy: "Em caso de não comparecimento sem aviso, novos agendamentos exigem pagamento antecipado.",
      companionsAllowed: true,
      preServiceInstructions: "Chegue alguns minutos antes do horário. Para coloração, venha com o cabelo sem produtos de fixação.",
    },
  });

  // Categorias sugeridas pelos segmentos do salão — o mesmo que o bootstrap faz para um salão novo
  const categories = await Promise.all(
    defaultCategories(segmentosDe(MARCAS.beauty, tenant)).map((c, sortOrder) => db.serviceCategory.create({ data: { tenantId: tenant.id, name: c.name, slug: c.slug, sortOrder } })),
  );
  const cat = (slug: string) => categories.find((c) => c.slug === slug)!.id;

  // Equipe: Ana (cabelo, dona), Mariana (unhas), Carlos (barbearia)
  const user = await db.user.create({
    data: { tenantId: tenant.id, name: "Ana Ribeiro", email: "demo@heeca.app", passwordHash: await bcrypt.hash("demo1234", 10) },
  });
  const ana = await db.professional.create({ data: { tenantId: tenant.id, userId: user.id, name: "Ana", bio: "Cabeleireira e colorista.", specialties: "Corte, coloração, mechas", sortOrder: 0 } });
  const marianaUser = await db.user.create({
    data: { tenantId: tenant.id, name: "Mariana Santos", email: "mariana@heeca.app", passwordHash: await bcrypt.hash("mari1234", 10), role: "STAFF" },
  });
  const mariana = await db.professional.create({ data: { tenantId: tenant.id, userId: marianaUser.id, name: "Mariana", bio: "Manicure, pedicure e nail designer.", specialties: "Unhas", commissionPercent: 50, sortOrder: 1 } });
  const carlos = await db.professional.create({ data: { tenantId: tenant.id, name: "Carlos", bio: "Barbeiro.", specialties: "Corte masculino, barba", commissionPercent: 40, sortOrder: 2 } });

  await db.availabilityRule.createMany({
    data: [
      // Ana: ter–sex 09:00–19:00 com almoço 12:30–13:30; sábado 08:00–15:00
      ...[2, 3, 4, 5].map((weekday) => ({
        tenantId: tenant.id, professionalId: ana.id, weekday, startMinutes: 9 * 60, endMinutes: 19 * 60, breakStartMinutes: 12 * 60 + 30, breakEndMinutes: 13 * 60 + 30,
      })),
      { tenantId: tenant.id, professionalId: ana.id, weekday: 6, startMinutes: 8 * 60, endMinutes: 15 * 60 },
      // Mariana: seg–sáb 10:00–18:00
      ...[1, 2, 3, 4, 5, 6].map((weekday) => ({ tenantId: tenant.id, professionalId: mariana.id, weekday, startMinutes: 10 * 60, endMinutes: 18 * 60 })),
      // Carlos: seg–sex 09:00–18:00 com almoço 12:00–13:00
      ...[1, 2, 3, 4, 5].map((weekday) => ({
        tenantId: tenant.id, professionalId: carlos.id, weekday, startMinutes: 9 * 60, endMinutes: 18 * 60, breakStartMinutes: 12 * 60, breakEndMinutes: 13 * 60,
      })),
    ],
  });

  // Serviços por categoria (SPEC §7)
  const svcData = [
    { name: "Corte feminino", categoryId: cat("cabelo"), description: "Corte com lavagem e finalização.", durationMinutes: 45, priceCents: 8000 },
    { name: "Escova", categoryId: cat("cabelo"), description: "Lavagem e escova modelada.", durationMinutes: 40, priceCents: 6000 },
    { name: "Hidratação", categoryId: cat("cabelo"), description: "Tratamento profundo com máscara e vapor.", durationMinutes: 60, priceCents: 9000 },
    { name: "Coloração", categoryId: cat("cabelo"), description: "Coloração completa com produtos profissionais.", durationMinutes: 120, priceCents: 22000, clientNotes: "Venha com o cabelo sem produtos de fixação. Faça o teste de mecha se for a primeira vez." },
    { name: "Manicure", categoryId: cat("unhas"), description: "Cutilagem, lixamento e esmaltação.", durationMinutes: 50, priceCents: 4500 },
    { name: "Pedicure", categoryId: cat("unhas"), description: "Cutilagem, lixamento e esmaltação.", durationMinutes: 60, priceCents: 5500 },
    { name: "Esmaltação em gel", categoryId: cat("unhas"), description: "Durabilidade de até 3 semanas.", durationMinutes: 75, priceCents: 9000, clientNotes: "Venha sem esmalte." },
    { name: "Design de sobrancelhas", categoryId: cat("sobrancelhas"), description: "Design com pinça e linha.", durationMinutes: 30, priceCents: 4000 },
    { name: "Corte masculino", categoryId: cat("cabelo"), description: "Corte na tesoura ou máquina, com acabamento.", durationMinutes: 40, priceCents: 5000 },
    { name: "Barba", categoryId: cat("cabelo"), description: "Barba com toalha quente e navalha.", durationMinutes: 30, priceCents: 4000 },
  ];
  const services: Service[] = [];
  for (const [i, s] of svcData.entries()) services.push(await db.service.create({ data: { ...s, tenantId: tenant.id, sortOrder: i } }));

  // Adicionais: somam tempo e preço ao serviço a que são anexados
  const addOnData = [
    { name: "Nail art", categoryId: cat("unhas"), description: "Desenhos à mão livre em até 4 unhas.", durationMinutes: 20, priceCents: 2500 },
    { name: "Francesinha", categoryId: cat("unhas"), description: "Clássica ou colorida.", durationMinutes: 15, priceCents: 1500 },
    { name: "Reconstrução na escova", categoryId: cat("cabelo"), description: "Ampola de reconstrução aplicada na lavagem.", durationMinutes: 15, priceCents: 3500 },
  ];
  const addOns: Service[] = [];
  for (const [i, a] of addOnData.entries()) addOns.push(await db.service.create({ data: { ...a, isAddOn: true, tenantId: tenant.id, sortOrder: svcData.length + i } }));

  const [corte, escova, hidratacao, coloracao, manicure, pedicure, gel, sobrancelha, corteMasc, barba] = services;
  const [nailArt, francesinha, reconstrucao] = addOns;
  // Quem faz o quê (SPEC §8)
  await db.professionalService.createMany({
    data: [
      ...[corte, escova, hidratacao, coloracao, sobrancelha, reconstrucao].map((s) => ({ professionalId: ana.id, serviceId: s.id })),
      ...[manicure, pedicure, gel, sobrancelha, nailArt, francesinha].map((s) => ({ professionalId: mariana.id, serviceId: s.id })),
      ...[corteMasc, barba].map((s) => ({ professionalId: carlos.id, serviceId: s.id })),
    ],
  });

  // Portfólio (SPEC §21)
  const photos = [
    { title: "Mechas loiras com corte em camadas", categoryId: cat("cabelo"), description: "Loiro iluminado, corte médio.", imageUrl: "https://images.unsplash.com/photo-1560869713-7d0a29430803?w=800&q=80" },
    { title: "Nail art floral", categoryId: cat("unhas"), description: "Esmaltação em gel com flores à mão livre.", imageUrl: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=800&q=80" },
    { title: "Francesinha clássica", categoryId: cat("unhas"), description: null, imageUrl: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800&q=80" },
    { title: "Design de sobrancelhas", categoryId: cat("sobrancelhas"), description: null, imageUrl: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=800&q=80" },
  ];
  for (const [i, p] of photos.entries()) await db.portfolioItem.create({ data: { ...p, tenantId: tenant.id, sortOrder: i } });

  // Clientes (SPEC §12)
  const clients = await Promise.all(
    [
      { name: "Maria Oliveira", phone: "+5511988880001", birthDate: new Date("1990-03-14"), preferredProfessionalId: ana.id, maintenanceIntervalDays: 30, notes: "Faz escova toda semana antes de eventos. Prefere a Ana." },
      { name: "Juliana Costa", phone: "+5511988880002", allergies: "Sensibilidade a amônia", notes: "Só coloração sem amônia." },
      { name: "Camila Ferreira", phone: "+5511988880003", email: "camila@example.com", ficha: { "unhas.formato": "Almond", "unhas.tamanho": "Médio" } },
      { name: "Pedro Almeida", phone: "+5511988880004", preferredProfessionalId: carlos.id, notes: "Corte na máquina 2 nas laterais." },
    ].map((c) => db.client.create({ data: { ...c, tenantId: tenant.id } })),
  );

  type Status = "CONFIRMED" | "AWAITING_CONFIRMATION" | "COMPLETED" | "NO_SHOW" | "CANCELLED_BY_CLIENT" | "RESCHEDULE_REQUESTED";
  type ItemSpec = { service: Service; professionalId: string; extras?: Service[] };

  /** Cria uma visita com os itens em sequência a partir de `startsAt` (SPEC §11). */
  const mk = (client: (typeof clients)[number], startsAt: Date, status: Status, specs: ItemSpec[]) => {
    let cursor = startsAt;
    const items = specs.map((spec, sortOrder) => {
      const extras = spec.extras ?? [];
      const durationMinutes = spec.service.durationMinutes + extras.reduce((s, a) => s + a.durationMinutes, 0);
      const priceCents = spec.service.priceCents + extras.reduce((s, a) => s + a.priceCents, 0);
      const itemStart = cursor;
      cursor = new Date(cursor.getTime() + durationMinutes * 60_000);
      return {
        tenantId: tenant.id, professionalId: spec.professionalId, serviceId: spec.service.id,
        startsAt: itemStart, endsAt: cursor, sortOrder,
        serviceName: extras.length ? `${spec.service.name} + ${extras.map((a) => a.name).join(", ")}` : spec.service.name,
        durationMinutes, priceCents,
        addOns: { create: extras.map((a) => ({ serviceId: a.id, name: a.name, durationMinutes: a.durationMinutes, priceCents: a.priceCents })) },
      };
    });
    return db.appointment.create({
      data: {
        tenantId: tenant.id, clientId: client.id,
        startsAt, endsAt: cursor,
        status, source: "PUBLIC",
        serviceName: specs.map((s) => s.service.name).join(" + "),
        durationMinutes: items.reduce((s, i) => s + i.durationMinutes, 0),
        priceCents: items.reduce((s, i) => s + i.priceCents, 0),
        items: { create: items },
        confirmationToken: nanoid(24),
        confirmedAt: status === "CONFIRMED" || status === "COMPLETED" || status === "RESCHEDULE_REQUESTED" ? startsAt : null,
        events: { create: { tenantId: tenant.id, actor: "CLIENT", type: "CREATED", toStatus: status } },
      },
    });
  };

  const [maria, juliana, camila, pedro] = clients;
  await Promise.all([
    // passado: Maria é recorrente; Juliana veio uma vez; Camila faltou
    mk(maria, at(-35, 9), "COMPLETED", [{ service: corte, professionalId: ana.id }, { service: escova, professionalId: ana.id, extras: [reconstrucao] }]),
    mk(maria, at(-21, 14), "COMPLETED", [{ service: escova, professionalId: ana.id }]),
    mk(juliana, at(-10, 9), "COMPLETED", [{ service: coloracao, professionalId: ana.id }, { service: manicure, professionalId: mariana.id }]),
    mk(camila, at(-2, 11), "NO_SHOW", [{ service: gel, professionalId: mariana.id, extras: [nailArt] }]),
    mk(pedro, at(-1, 16), "CANCELLED_BY_CLIENT", [{ service: corteMasc, professionalId: carlos.id }]),
    // hoje e futuro — o exemplo do spec: Corte + Escova (Ana) + Manicure (Mariana) = 2h15
    mk(maria, at(0, 14), "CONFIRMED", [{ service: corte, professionalId: ana.id }, { service: escova, professionalId: ana.id }, { service: manicure, professionalId: mariana.id, extras: [francesinha] }]),
    mk(camila, at(0, 15), "AWAITING_CONFIRMATION", [{ service: gel, professionalId: mariana.id }]),
    mk(pedro, at(1, 10), "CONFIRMED", [{ service: corteMasc, professionalId: carlos.id }, { service: barba, professionalId: carlos.id }]),
    mk(juliana, at(2, 9), "RESCHEDULE_REQUESTED", [{ service: hidratacao, professionalId: ana.id }]),
    mk(camila, at(3, 10), "CONFIRMED", [{ service: sobrancelha, professionalId: mariana.id }, { service: pedicure, professionalId: mariana.id }]),
  ]);

  console.log([
    "Seed concluído.",
    "  Responsável: demo@heeca.app / demo1234",
    "  Profissional (STAFF): mariana@heeca.app / mari1234",
    `  Página pública: /agendar/${SLUG}`,
  ].join("\n"));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

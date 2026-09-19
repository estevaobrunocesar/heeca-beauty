/**
 * Seed de desenvolvimento: cria um studio de Nail Design de exemplo com procedimentos por categoria,
 * adicionais, portfólio, políticas, clientes com ficha técnica e alguns agendamentos.
 * Logins: demo@heeca.app / demo1234 (responsável) · bia@heeca.app / bia12345 (profissional STAFF)
 */
import "dotenv/config";
import { PrismaClient, type Service } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { fromZonedTime } from "date-fns-tz";
import { addDays, format, set } from "date-fns";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const TZ = "America/Sao_Paulo";
const SLUG = "studio-ana-nails";

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
      businessName: "Studio Ana Nails",
      ownerName: "Ana Ribeiro",
      description: "Alongamento em fibra de vidro, esmaltação em gel e nail art autoral. Atendimento individual, com hora marcada, em um espaço pensado para você relaxar.",
      phone: "+5511999990000",
      address: "Rua das Acácias, 45 - sala 3",
      city: "São Paulo - SP",
      instagram: "studioananails",
      pendingExpiryMinutes: 120,
      bufferMinutes: 10,
      // Políticas (seção 14)
      lateToleranceMinutes: 10,
      cancellationPolicy: "Cancelamentos com menos de 24h de antecedência podem ter o sinal retido. Avise pelo WhatsApp o quanto antes.",
      reschedulePolicy: "Reagendamentos até 12h antes do horário, sujeitos à disponibilidade.",
      noShowPolicy: "Em caso de não comparecimento sem aviso, novos agendamentos exigem pagamento antecipado.",
      companionsAllowed: false,
      preServiceInstructions: "Chegue alguns minutos antes do horário marcado. Se estiver com alongamento de outro studio, avise antes para incluirmos a remoção.",
    },
  });

  const user = await db.user.create({
    data: { tenantId: tenant.id, name: "Ana Ribeiro", email: "demo@heeca.app", passwordHash: await bcrypt.hash("demo1234", 10) },
  });
  const ana = await db.professional.create({ data: { tenantId: tenant.id, userId: user.id, name: "Ana", bio: "Especialista em fibra de vidro e nail art.", sortOrder: 0 } });
  const biaUser = await db.user.create({
    data: { tenantId: tenant.id, name: "Bia Santos", email: "bia@heeca.app", passwordHash: await bcrypt.hash("bia12345", 10), role: "STAFF" },
  });
  const bia = await db.professional.create({ data: { tenantId: tenant.id, userId: biaUser.id, name: "Bia", bio: "Manicure, pedicure e esmaltação em gel.", sortOrder: 1 } });

  await db.availabilityRule.createMany({
    data: [
      // Ana: ter–sex 09:00–19:00 com almoço 12:30–13:30; sábado 08:00–15:00
      ...[2, 3, 4, 5].map((weekday) => ({
        tenantId: tenant.id, professionalId: ana.id, weekday, startMinutes: 9 * 60, endMinutes: 19 * 60, breakStartMinutes: 12 * 60 + 30, breakEndMinutes: 13 * 60 + 30,
      })),
      { tenantId: tenant.id, professionalId: ana.id, weekday: 6, startMinutes: 8 * 60, endMinutes: 15 * 60 },
      // Bia: seg–sáb 10:00–18:00
      ...[1, 2, 3, 4, 5, 6].map((weekday) => ({ tenantId: tenant.id, professionalId: bia.id, weekday, startMinutes: 10 * 60, endMinutes: 18 * 60 })),
    ],
  });

  // Procedimentos (seção 3.2) — durações da seção 6.2
  const svcData = [
    { name: "Manicure tradicional", category: "MANICURE", description: "Cutilagem, lixamento e esmaltação comum.", durationMinutes: 45, priceCents: 4500 },
    { name: "Esmaltação em gel", category: "MANICURE", description: "Durabilidade de até 3 semanas, com brilho intenso.", durationMinutes: 75, priceCents: 9000, clientNotes: "Venha sem esmalte. Se estiver com gel de outro lugar, escolha também o adicional de remoção." },
    { name: "Pedicure tradicional", category: "PEDICURE", description: "Cutilagem, lixamento e esmaltação.", durationMinutes: 60, priceCents: 5500 },
    { name: "Spa dos pés", category: "PEDICURE", description: "Esfoliação, hidratação profunda e massagem relaxante.", durationMinutes: 60, priceCents: 8000 },
    { name: "Alongamento em fibra de vidro", category: "ALONGAMENTO", description: "Alongamento resistente e natural, com formato à sua escolha.", durationMinutes: 150, priceCents: 22000, clientNotes: "Reserve 2h30. Não é possível aplicar sobre unhas com micose ou lesões." },
    { name: "Manutenção de fibra", category: "ALONGAMENTO", description: "Para quem já usa fibra: reforço, ajuste de formato e esmaltação.", durationMinutes: 120, priceCents: 14000 },
    { name: "Alongamento em gel", category: "ALONGAMENTO", description: "Alongamento em gel moldado, flexível e leve.", durationMinutes: 150, priceCents: 20000 },
    { name: "Remoção de alongamento", category: "ALONGAMENTO", description: "Remoção segura com preservação da unha natural.", durationMinutes: 45, priceCents: 5000 },
    { name: "Blindagem", category: "ADICIONAL", description: "Camada protetora para fortalecer a unha natural.", durationMinutes: 60, priceCents: 8000 },
  ] as const;
  const services: Service[] = [];
  for (const [i, s] of svcData.entries()) services.push(await db.service.create({ data: { ...s, tenantId: tenant.id, sortOrder: i } }));

  // Adicionais (seção 6.3): somam tempo e preço ao procedimento principal
  const addOnData = [
    { name: "Nail art", description: "Desenhos delicados à mão livre em até 4 unhas.", durationMinutes: 20, priceCents: 2500 },
    { name: "Francesinha", description: "Clássica ou colorida.", durationMinutes: 15, priceCents: 1500 },
    { name: "Pedrarias", description: "Aplicação de strass e pedras.", durationMinutes: 15, priceCents: 2000 },
    { name: "Encapsulada", description: "Efeito encapsulado com glitter, folhas ou flores secas.", durationMinutes: 30, priceCents: 4000 },
    { name: "Remoção de procedimento anterior", description: "Remoção de gel ou alongamento de outro studio.", durationMinutes: 30, priceCents: 3000 },
  ];
  const addOns: Service[] = [];
  for (const [i, a] of addOnData.entries()) addOns.push(await db.service.create({ data: { ...a, category: "ADICIONAL", isAddOn: true, tenantId: tenant.id, sortOrder: svcData.length + i } }));

  const [manicure, gel, pedicure, spa, fibra, manutencao, alongGel, remocao, blindagem] = services;
  const [nailArt, francesinha, pedrarias] = addOns;
  // Ana faz alongamentos e gel; Bia faz manicure, pedicure e gel. Adicionais valem para as duas.
  await db.professionalService.createMany({
    data: [
      ...[gel, fibra, manutencao, alongGel, remocao, blindagem, ...addOns].map((s) => ({ professionalId: ana.id, serviceId: s.id })),
      ...[manicure, gel, pedicure, spa, blindagem, ...addOns].map((s) => ({ professionalId: bia.id, serviceId: s.id })),
    ],
  });

  // Portfólio (seção 13)
  const photos = [
    { title: "Alongamento almond em fibra", category: "ALONGAMENTO", description: "Fibra de vidro, formato almond, nude com francesinha fina.", imageUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80" },
    { title: "Nail art floral", category: "MANICURE", description: "Esmaltação em gel com flores à mão livre.", imageUrl: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=800&q=80" },
    { title: "Francesinha clássica", category: "MANICURE", description: null, imageUrl: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800&q=80" },
    { title: "Banho de gel vermelho", category: "MANICURE", description: "Gel de cobertura em vermelho clássico.", imageUrl: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=800&q=80" },
    { title: "Encapsulada com glitter", category: "ADICIONAL", description: null, imageUrl: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=800&q=80" },
  ] as const;
  for (const [i, p] of photos.entries()) await db.portfolioItem.create({ data: { ...p, tenantId: tenant.id, sortOrder: i } });

  // Clientes com ficha técnica (seção 11)
  const clients = await Promise.all(
    [
      { name: "Maria Oliveira", phone: "+5511988880001", nailShape: "Almond", nailSize: "Médio", maintenanceIntervalDays: 20, notes: "Prefere esmaltação nude. Costuma agendar manutenção a cada 20 dias." },
      { name: "Juliana Costa", phone: "+5511988880002", nailShape: "Quadrado", nailSize: "Curto", allergies: "Sensibilidade ao primer ácido", notes: "Usar primer sem ácido." },
      { name: "Camila Ferreira", phone: "+5511988880003", email: "camila@example.com", nailShape: "Bailarina", nailSize: "Longo" },
      { name: "Fernanda Lima", phone: "+5511988880004", notes: "Gosta de francesinha colorida." },
    ].map((c) => db.client.create({ data: { ...c, tenantId: tenant.id } })),
  );

  const mk = (
    client: (typeof clients)[number], service: (typeof services)[number], startsAt: Date, professionalId: string,
    status: "CONFIRMED" | "AWAITING_CONFIRMATION" | "COMPLETED" | "NO_SHOW" | "CANCELLED_BY_CLIENT" | "RESCHEDULE_REQUESTED",
    extras: (typeof addOns)[number][] = [],
  ) => {
    const durationMinutes = service.durationMinutes + extras.reduce((s, a) => s + a.durationMinutes, 0);
    const priceCents = service.priceCents + extras.reduce((s, a) => s + a.priceCents, 0);
    return db.appointment.create({
      data: {
        tenantId: tenant.id, professionalId, serviceId: service.id, clientId: client.id,
        startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
        status, source: "PUBLIC", serviceName: service.name, durationMinutes, priceCents,
        addOns: { create: extras.map((a) => ({ serviceId: a.id, name: a.name, durationMinutes: a.durationMinutes, priceCents: a.priceCents })) },
        confirmationToken: nanoid(24),
        confirmedAt: status === "CONFIRMED" || status === "COMPLETED" || status === "RESCHEDULE_REQUESTED" ? startsAt : null,
        events: { create: { tenantId: tenant.id, actor: "CLIENT", type: "CREATED", toStatus: status } },
      },
    });
  };

  await Promise.all([
    // passado: Maria é recorrente (manutenção a cada ~20 dias), Juliana veio uma vez, Fernanda faltou
    mk(clients[0], fibra, at(-62, 9), ana.id, "COMPLETED", [nailArt]),
    mk(clients[0], manutencao, at(-41, 9), ana.id, "COMPLETED"),
    mk(clients[0], manutencao, at(-22, 14), ana.id, "COMPLETED", [francesinha]),
    mk(clients[1], gel, at(-10, 11), bia.id, "COMPLETED"),
    mk(clients[2], alongGel, at(-5, 9), ana.id, "COMPLETED", [pedrarias, nailArt]),
    mk(clients[3], pedicure, at(-2, 11), bia.id, "NO_SHOW"),
    mk(clients[1], manicure, at(-1, 16), bia.id, "CANCELLED_BY_CLIENT"),
    // hoje e futuro
    mk(clients[1], gel, at(0, 14), bia.id, "CONFIRMED", [francesinha]),
    mk(clients[2], manutencao, at(0, 15), ana.id, "AWAITING_CONFIRMATION"),
    mk(clients[3], spa, at(1, 10), bia.id, "CONFIRMED"),
    mk(clients[2], remocao, at(2, 9), ana.id, "RESCHEDULE_REQUESTED"),
    mk(clients[1], fibra, at(3, 9), ana.id, "CONFIRMED", [addOns.find((a) => a.name === "Encapsulada") ?? addOns[0]]),
  ]);

  console.log([
    "Seed concluído.",
    "  Responsável: demo@heeca.app / demo1234",
    "  Profissional (STAFF): bia@heeca.app / bia12345",
    `  Página pública: /agendar/${SLUG}`,
  ].join("\n"));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

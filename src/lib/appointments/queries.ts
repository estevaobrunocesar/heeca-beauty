import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Include padrão para listar visitas em cartões: cliente + itens com profissional e adicionais. */
export const cardInclude = {
  client: true,
  items: {
    orderBy: { sortOrder: "asc" },
    include: { professional: { select: { id: true, name: true, photoUrl: true } }, room: { select: { name: true } }, addOns: { select: { name: true } } },
  },
} satisfies Prisma.AppointmentInclude;

/** Filtro "visitas em que ao menos um item é de um destes profissionais" (STAFF só vê as suas). */
export const withProfessionals = (professionalIds: string[]): Prisma.AppointmentWhereInput => ({
  items: { some: { professionalId: { in: professionalIds } } },
});

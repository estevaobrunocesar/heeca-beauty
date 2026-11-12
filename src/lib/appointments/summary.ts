/**
 * Resumos de uma visita (Appointment + AppointmentItem[]) para mensagens, listagens e telas.
 * Funções puras: servem no servidor, no cron e em componentes cliente.
 */

export type ItemSummary = { serviceName: string; professional?: { name: string } | null; startsAt?: Date; durationMinutes?: number; priceCents?: number };

/** "Corte + Escova + Manicure" — nomes dos itens na ordem da visita. */
export function describeVisit(items: Pick<ItemSummary, "serviceName">[]): string {
  return items.map((i) => i.serviceName).join(" + ");
}

/** "Ana" ou "Ana e Mariana" — profissionais distintos, na ordem em que aparecem. */
export function describeProfessionals(items: Pick<ItemSummary, "professional">[]): string {
  const names = [...new Set(items.map((i) => i.professional?.name).filter((n): n is string => !!n))];
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Ids distintos dos profissionais envolvidos. */
export function professionalIdsOf<T extends { professionalId: string }>(items: T[]): string[] {
  return [...new Set(items.map((i) => i.professionalId))];
}

/** Soma de duração e preço dos itens. */
export function visitTotals(items: { durationMinutes: number; priceCents: number }[]) {
  return items.reduce(
    (acc, i) => ({ durationMinutes: acc.durationMinutes + i.durationMinutes, priceCents: acc.priceCents + i.priceCents }),
    { durationMinutes: 0, priceCents: 0 },
  );
}

type ItemDoRecorte = { professionalId: string; serviceName: string; startsAt: Date; endsAt: Date; priceCents: number };
type VisitaDoRecorte = { startsAt: Date; endsAt: Date; serviceName: string; priceCents: number; durationMinutes: number };

/**
 * Visão de quem não vê a equipe (profissional): só os serviços dele. Nome, horário, duração e valor da visita passam a ser
 * os do próprio trabalho; `totalCents` guarda o valor da conta inteira (o fechamento continua somando todos os serviços).
 * Se nenhum item é dele, devolve a visita como está.
 */
export function recorteDoProfissional<I extends ItemDoRecorte, A extends VisitaDoRecorte & { items: I[] }>(a: A, professionalIds: string[]) {
  const meus = a.items.filter((i) => professionalIds.includes(i.professionalId));
  if (meus.length === 0 || meus.length === a.items.length) return { ...a, totalCents: a.priceCents, recortada: false };
  const startsAt = new Date(Math.min(...meus.map((i) => i.startsAt.getTime())));
  const endsAt = new Date(Math.max(...meus.map((i) => i.endsAt.getTime())));
  return {
    ...a,
    items: meus,
    serviceName: describeVisit(meus),
    priceCents: meus.reduce((n, i) => n + i.priceCents, 0),
    startsAt,
    endsAt,
    durationMinutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000),
    totalCents: a.priceCents,
    recortada: true,
  };
}

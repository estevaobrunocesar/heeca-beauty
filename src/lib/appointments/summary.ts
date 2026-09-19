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

/**
 * Adicionais (seção 6.3): nail art, francesinha, pedrarias, encapsulada, remoção…
 * Um adicional é um Service com `isAddOn = true`. Ele nunca é agendado sozinho:
 * a cliente escolhe um procedimento principal e marca os adicionais que quiser;
 * cada um soma tempo e preço ao agendamento.
 */

export type Priced = { durationMinutes: number; priceCents: number };

export type BookingTotals = {
  durationMinutes: number;
  priceCents: number;
  /** Quanto os adicionais acrescentaram (para exibir "+ 30 min · + R$ 25,00"). */
  extraMinutes: number;
  extraCents: number;
};

/** Soma o procedimento principal e os adicionais. Função pura: usada no servidor e no wizard público. */
export function computeBookingTotals(main: Priced, addOns: Priced[]): BookingTotals {
  const extraMinutes = addOns.reduce((sum, a) => sum + a.durationMinutes, 0);
  const extraCents = addOns.reduce((sum, a) => sum + a.priceCents, 0);
  return {
    durationMinutes: main.durationMinutes + extraMinutes,
    priceCents: main.priceCents + extraCents,
    extraMinutes,
    extraCents,
  };
}

/** Nome exibido na agenda: "Alongamento em fibra + Nail art, Francesinha". */
export function describeBooking(mainName: string, addOnNames: string[]): string {
  return addOnNames.length ? `${mainName} + ${addOnNames.join(", ")}` : mainName;
}

/** Remove ids repetidos e limita a quantidade (proteção contra payloads abusivos). */
export function normalizeAddOnIds(ids: readonly string[] | null | undefined, max = 10): string[] {
  return [...new Set((ids ?? []).map((s) => s.trim()).filter(Boolean))].slice(0, max);
}

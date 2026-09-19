const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatCents = (cents: number) => brl.format(cents / 100);

/** "45,90" | "45.90" | "R$ 45,90" -> 4590 */
export function parseMoneyToCents(input: string): number | null {
  const clean = input.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(clean);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

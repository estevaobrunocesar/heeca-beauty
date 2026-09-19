/**
 * Normaliza telefones brasileiros para E.164 (+55DDDNUMERO).
 * Aceita "(11) 99999-8888", "11999998888", "+55 11 99999 8888", etc.
 * Retorna null se não conseguir interpretar.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  // Sem DDI: assume Brasil
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return "+" + digits;
  // Outros países: aceita 8..15 dígitos com DDI
  if (digits.length >= 8 && digits.length <= 15) return "+" + digits;
  return null;
}

/** +5511999998888 -> (11) 99999-8888 */
export function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    const split = rest.length === 9 ? 5 : 4;
    return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
  }
  return e164;
}

export function whatsappLink(e164: string, text?: string) {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

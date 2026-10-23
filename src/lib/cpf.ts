/** Só dígitos do CPF, ou null se não tiver 11 dígitos. */
export function onlyCpfDigits(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  return d.length === 11 ? d : null;
}

/** CPF válido: 11 dígitos, não todos iguais e com os dois dígitos verificadores corretos. */
export function isValidCpf(input: string | null | undefined): boolean {
  const d = onlyCpfDigits(input);
  if (!d || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

/** 12345678909 → 123.456.789-09 (para exibir). */
export function formatCpf(input: string): string {
  const d = onlyCpfDigits(input);
  return d ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : input;
}

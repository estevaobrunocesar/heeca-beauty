// CSV para o Excel brasileiro: separador ";", BOM UTF-8 (acentos) e vírgula decimal.
// Células de texto que começam com = + - @ ganham um apóstrofo (o Excel executaria como fórmula: injeção de CSV).

const PERIGOSO = /^[=+\-@\t\r]/;

export function celula(v: string | number | null | undefined): string {
  if (v == null) return "";
  let s = String(v);
  if (typeof v === "string" && PERIGOSO.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const reais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export function toCsv(cabecalho: string[], linhas: (string | number | null)[][]): string {
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
}

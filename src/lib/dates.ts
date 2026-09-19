import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { addDays, format, parse } from "date-fns";

/**
 * Convenção do sistema:
 *  - Banco e lógica trabalham em UTC (Date).
 *  - Tudo que o usuário vê/escolhe é no fuso do tenant (padrão America/Sao_Paulo).
 *  - Datas "de calendário" (sem hora) circulam como string "YYYY-MM-DD".
 */

export const DEFAULT_TZ = "America/Sao_Paulo";

export type DateKey = string; // YYYY-MM-DD

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Instante UTC correspondente a `dateKey` + `minutes` no fuso informado. */
export function zonedDateTimeToUtc(dateKey: DateKey, minutes: number, tz: string): Date {
  const local = parse(dateKey, "yyyy-MM-dd", new Date());
  local.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return fromZonedTime(local, tz);
}

/** Data de calendário (no fuso) de um instante UTC. */
export function toDateKey(date: Date, tz: string): DateKey {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

/** Minutos desde 00:00 (no fuso) de um instante UTC. */
export function toMinutesOfDay(date: Date, tz: string): number {
  const z = toZonedTime(date, tz);
  return z.getHours() * 60 + z.getMinutes();
}

export function todayKey(tz: string): DateKey {
  return toDateKey(new Date(), tz);
}

export function addDaysToKey(dateKey: DateKey, days: number): DateKey {
  return format(addDays(parse(dateKey, "yyyy-MM-dd", new Date()), days), "yyyy-MM-dd");
}

/** 0 = domingo ... 6 = sábado, para uma data de calendário. */
export function weekdayOfKey(dateKey: DateKey): number {
  return parse(dateKey, "yyyy-MM-dd", new Date()).getDay();
}

export function dateKeyToDate(dateKey: DateKey): Date {
  return parse(dateKey, "yyyy-MM-dd", new Date());
}

// ───────── Formatação pt-BR ─────────

/** "quinta-feira, 17 de setembro" → "Quinta-feira, 17 de setembro" */
export const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function fmtDate(date: Date, tz: string, pattern = "dd/MM/yyyy") {
  return formatInTimeZone(date, tz, pattern, { locale: ptBR });
}

export function fmtTime(date: Date, tz: string) {
  return formatInTimeZone(date, tz, "HH:mm");
}

export function fmtDateTime(date: Date, tz: string) {
  return formatInTimeZone(date, tz, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/** "seg., 20 de set." */
export function fmtDateShort(date: Date, tz: string) {
  return ucfirst(formatInTimeZone(date, tz, "EEE, d 'de' MMM", { locale: ptBR }));
}

export function fmtDateKeyLong(dateKey: DateKey) {
  return ucfirst(format(dateKeyToDate(dateKey), "EEEE, d 'de' MMMM", { locale: ptBR }));
}

export const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

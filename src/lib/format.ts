/**
 * Pure formatting and calendar helpers (no React Native imports — unit-tested under Node).
 * Instants are UTC; days, weeks and wall-clock times are always shown in the registration's
 * (or the company's) IANA time zone via Intl.
 */

export type Lang = 'en' | 'nl';
export const DEFAULT_TZ = 'Europe/Amsterdam';

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const localeOf = (lang: Lang) => (lang === 'nl' ? 'nl-NL' : 'en-GB');
const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));

// ---------------------------------------------------------------------------------------------
// Durations

/** "8h 12m" (en) / "8u 12m" (nl). Rounded to the minute, never negative. */
export function formatDuration(ms: number, lang: Lang): string {
  const m = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(m / 60)}${lang === 'nl' ? 'u' : 'h'} ${pad2(m % 60)}m`;
}

/** Live timer "HH:MM:SS" (floored to the second). */
export function formatTimer(ms: number): string {
  const x = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(x / 3600))}:${pad2(Math.floor(x / 60) % 60)}:${pad2(x % 60)}`;
}

/** Contract hours: "40", "32.5" (en) / "32,5" (nl). */
export function formatHours(h: number, lang: Lang): string {
  const s = Number.isInteger(h) ? String(h) : String(Math.round(h * 10) / 10);
  return lang === 'nl' ? s.replace('.', ',') : s;
}

// ---------------------------------------------------------------------------------------------
// Time zones (Intl only)

export type LocalParts = { y: number; m: number; d: number; h: number; mi: number; s: number; wd: number };

const partsFmt = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short',
    });
    partsFmt.set(tz, f);
  }
  return f;
}
const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Wall-clock parts of an instant in `tz`. `wd` is ISO (Mon = 1 … Sun = 7). */
export function localParts(date: Date | string | number, tz = DEFAULT_TZ): LocalParts {
  const p: Record<string, string> = {};
  for (const x of partsFormatter(tz).formatToParts(toDate(date))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, wd: WD[p.weekday] ?? 1 };
}

function offsetMs(date: Date, tz: string): number {
  const l = localParts(date, tz);
  return Date.UTC(l.y, l.m - 1, l.d, l.h, l.mi, l.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock in `tz` reads y-m-d h:mi (m 1-based; out-of-range days roll over). */
export function zonedTime(y: number, m: number, d: number, h = 0, mi = 0, tz = DEFAULT_TZ): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const off = offsetMs(new Date(guess), tz);
  let t = guess - off;
  const off2 = offsetMs(new Date(t), tz);
  if (off2 !== off) t = guess - off2;
  return new Date(t);
}

export function startOfDay(date: Date | string | number, tz = DEFAULT_TZ): Date {
  const l = localParts(date, tz);
  return zonedTime(l.y, l.m, l.d, 0, 0, tz);
}

/** Monday 00:00 of the ISO week containing `date`. */
export function startOfWeek(date: Date | string | number, tz = DEFAULT_TZ): Date {
  const l = localParts(date, tz);
  return zonedTime(l.y, l.m, l.d - (l.wd - 1), 0, 0, tz);
}

export function startOfMonth(date: Date | string | number, tz = DEFAULT_TZ): Date {
  const l = localParts(date, tz);
  return zonedTime(l.y, l.m, 1, 0, 0, tz);
}

export function addDays(date: Date | string | number, days: number, tz = DEFAULT_TZ): Date {
  const l = localParts(date, tz);
  return zonedTime(l.y, l.m, l.d + days, l.h, l.mi, tz);
}

/** yyyy-mm-dd of the local day. */
export function dayKey(date: Date | string | number, tz = DEFAULT_TZ): string {
  const l = localParts(date, tz);
  return `${l.y}-${pad2(l.m)}-${pad2(l.d)}`;
}

export type Period = 'week' | 'last' | 'month';

/** [from, to) for the Registrations segmented control, in the company's zone. */
export function periodRange(period: Period, now: Date | number, tz = DEFAULT_TZ): [Date, Date] {
  if (period === 'month') {
    const l = localParts(now, tz);
    return [zonedTime(l.y, l.m, 1, 0, 0, tz), zonedTime(l.y, l.m + 1, 1, 0, 0, tz)];
  }
  const wk = startOfWeek(now, tz);
  const l = localParts(wk, tz);
  return period === 'week'
    ? [wk, zonedTime(l.y, l.m, l.d + 7, 0, 0, tz)]
    : [zonedTime(l.y, l.m, l.d - 7, 0, 0, tz), wk];
}

// ---------------------------------------------------------------------------------------------
// Dates and times

/** "07:58" in `tz`. */
export function formatTime(date: Date | string | number, tz = DEFAULT_TZ): string {
  const l = localParts(date, tz);
  return `${pad2(l.h)}:${pad2(l.mi)}`;
}

/** "07:58 – 17:20", or "07:58 – running" for an open registration. */
export function formatRange(inAt: Date | string | number, outAt: Date | string | number | null, tz: string, runningLabel: string) {
  return `${formatTime(inAt, tz)} – ${outAt == null ? runningLabel : formatTime(outAt, tz)}`;
}

function fmtDate(date: Date | string | number, lang: Lang, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeOf(lang), { timeZone: tz, ...opts }).format(toDate(date));
}

const cleanComma = (s: string) => s.replace(',', '');

/** "Thursday 24 September" / "donderdag 24 september". */
export function formatDateLong(date: Date | string | number, lang: Lang, tz = DEFAULT_TZ) {
  return cleanComma(fmtDate(date, lang, tz, { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** Day-group header: "Wednesday 23 Sept" / "woensdag 23 sep". */
export function formatDayHeader(date: Date | string | number, lang: Lang, tz = DEFAULT_TZ) {
  return cleanComma(fmtDate(date, lang, tz, { weekday: 'long', day: 'numeric', month: 'short' }));
}

/** Short day chip: "Thu 24" / "do 24". */
export function formatDayChip(date: Date | string | number, lang: Lang, tz = DEFAULT_TZ) {
  return cleanComma(fmtDate(date, lang, tz, { weekday: 'short', day: 'numeric' })).replace('.', '');
}

/** "September" — capitalised also in Dutch, as a segmented-control label. */
export function monthLabel(date: Date | string | number, lang: Lang, tz = DEFAULT_TZ) {
  const s = fmtDate(date, lang, tz, { month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type DayPart = 'morning' | 'afternoon' | 'evening';
/** Afternoon from 12:00, evening from 18:00. */
export const dayPart = (hour: number): DayPart => (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening');

// ---------------------------------------------------------------------------------------------
// People and beacons

export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/** "Sanne de Vries" → "SV" (first + last word, skipping lowercase particles naturally). */
export function initials(name: string | null | undefined, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return (email ?? '?').slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** "5A4B0C1E-7F3D…" */
export const shortUuid = (uuid: string) => (uuid.length > 13 ? `${uuid.slice(0, 13)}…` : uuid);

/** "1042/1 · −61 dBm" (typographic minus). */
export function formatRanged(b: { major: number; minor: number; rssi: number }) {
  const r = Math.round(b.rssi);
  return `${b.major}/${b.minor} · ${r < 0 ? '−' : ''}${Math.abs(r)} dBm`;
}

// ---------------------------------------------------------------------------------------------
// Correction form

/** "7:58" / "07:58" → minutes after midnight, or null. */
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Keystroke mask for a time field: keeps digits, inserts the colon ("0758" → "07:58"). */
export function maskTime(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

export type CorrectionError = 'time' | 'out_before_in' | 'too_long';
const MAX_MINUTES = 16 * 60;

/**
 * Client-side rules (the server applies the same): both "HH:MM" on the registration's day, so check-out
 * after check-in also means "same day"; at most 16 h.
 */
export function validateCorrection(checkIn: string, checkOut: string): CorrectionError | null {
  const a = parseHHMM(checkIn), b = parseHHMM(checkOut);
  if (a == null || b == null) return 'time';
  if (b <= a) return 'out_before_in';
  if (b - a > MAX_MINUTES) return 'too_long';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Lists

export interface DayGroup<T> { key: string; first: T; items: T[] }

/** Groups (already newest-first) registrations by local day, keeping order. */
export function groupByDay<T extends { checkInAt: string; timezone?: string | null }>(items: T[], fallbackTz = DEFAULT_TZ): DayGroup<T>[] {
  const out: DayGroup<T>[] = [];
  const idx = new Map<string, DayGroup<T>>();
  for (const it of items) {
    const key = dayKey(it.checkInAt, it.timezone || fallbackTz);
    let g = idx.get(key);
    if (!g) { g = { key, first: it, items: [] }; idx.set(key, g); out.push(g); }
    g.items.push(it);
  }
  return out;
}

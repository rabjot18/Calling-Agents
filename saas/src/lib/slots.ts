import "server-only";
import { now } from "./db";
import type { Day, Profile } from "./profile";

// Shared by every calendar provider: opening-hours maths in the business's time zone and the slot finder.
// Offset (ms) of `tz` at instant `ms`: local wall-clock read as UTC minus the instant.
function tzOffset(ms: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
}
// Local wall-clock (YYYY-MM-DD + HH:MM in tz) → UTC instant. Two passes handle DST edges.
export function zoned(date: string, hhmm: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffset(guess, tz);
  return guess - tzOffset(first, tz);
}
export const localDate = (ms: number, tz: string) => new Date(ms).toLocaleDateString("en-CA", { timeZone: tz });
const WEEKDAY: Record<string, Day> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };
const weekday = (date: string, tz: string) => WEEKDAY[new Date(zoned(date, "12:00", tz)).toLocaleDateString("en-US", { weekday: "short", timeZone: tz })];
export const slotLabel = (ms: number, tz: string) =>
  `${new Date(ms).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz })} at ${new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}`;

// Open slots inside opening hours, at least 60 min from now, not overlapping busy times. ≤3 per day, ≤6 total.
export function openSlots(p: Profile, busy: { start: number; end: number }[], fromDate: string, toDate: string, durationMin: number, step = 30) {
  const out: { start: number; end: number }[] = [];
  const earliest = now() + 60 * 60_000;
  const dur = Math.max(15, Math.min(480, durationMin)) * 60_000;
  let date = fromDate;
  for (let i = 0; i < 14 && date <= toDate && out.length < 6; i++) {
    const h = p.hours[weekday(date, p.timezone)];
    if (h) {
      const open = zoned(date, h.open, p.timezone);
      const close = zoned(date, h.close, p.timezone);
      let perDay = 0;
      for (let s = open; s + dur <= close && perDay < 3 && out.length < 6; s += step * 60_000) {
        if (s < earliest) continue;
        if (busy.some((b) => s < b.end && s + dur > b.start)) continue;
        out.push({ start: s, end: s + dur });
        perDay++;
        s += 60 * 60_000; // spread offers through the day rather than 9:00, 9:30, 10:00
      }
    }
    date = localDate(zoned(date, "12:00", p.timezone) + 86400_000, p.timezone);
  }
  return out;
}

// Is [start,end) inside the business's opening hours on its local day?
export function withinHours(p: Profile, start: number, end: number) {
  const date = localDate(start, p.timezone);
  const h = p.hours[weekday(date, p.timezone)];
  return !!h && start >= zoned(date, h.open, p.timezone) && end <= zoned(date, h.close, p.timezone);
}

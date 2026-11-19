// Offline checks for the slot finder + time-zone maths (no Google calls). Run:
//   npx tsx --conditions=react-server --env-file=.env.local scripts/test-calendar-slots.ts
import { localDate, openSlots, slotLabel, withinHours, zoned } from "@/lib/slots";
import { emptyProfile } from "@/lib/profile";

let fails = 0;
const ok = (cond: boolean, what: string) => { console.log(`${cond ? "PASS" : "FAIL"}  ${what}`); if (!cond) fails++; };
const p = { ...emptyProfile(), timezone: "America/Halifax" };
p.hours = { mon: null, tue: { open: "09:00", close: "19:00" }, wed: { open: "09:00", close: "19:00" }, thu: { open: "09:00", close: "20:00" }, fri: { open: "09:00", close: "20:00" }, sat: { open: "09:00", close: "17:00" }, sun: null };

// 1. zoned(): 9:00 Halifax in November (AST, UTC-4) is 13:00 UTC; in July (ADT, UTC-3) it is 12:00 UTC.
ok(new Date(zoned("2026-11-19", "09:00", "America/Halifax")).toISOString() === "2026-11-19T13:00:00.000Z", "zoned 9:00 AST = 13:00Z");
ok(new Date(zoned("2026-07-16", "09:00", "America/Halifax")).toISOString() === "2026-07-16T12:00:00.000Z", "zoned 9:00 ADT = 12:00Z (DST)");
// 2. Next Thursday-ish window: pick a date a week out so 'now + 60 min' never interferes.
const base = Date.now() + 7 * 86400_000;
let d = localDate(base, p.timezone);
while (new Date(zoned(d, "12:00", p.timezone)).toLocaleDateString("en-US", { weekday: "short", timeZone: p.timezone }) !== "Thu") d = localDate(zoned(d, "12:00", p.timezone) + 86400_000, p.timezone);
const busy = [{ start: zoned(d, "09:00", p.timezone), end: zoned(d, "11:00", p.timezone) }, { start: zoned(d, "13:00", p.timezone), end: zoned(d, "14:00", p.timezone) }];
const slots = openSlots(p, busy, d, d, 60);
console.log("  Thursday", d, "→", slots.map((s) => slotLabel(s.start, p.timezone)));
ok(slots.length > 0 && slots.length <= 3, "≤3 slots on one day");
ok(slots.every((s) => !busy.some((b) => s.start < b.end && s.end > b.start)), "no slot overlaps a busy event");
ok(slots.every((s) => withinHours(p, s.start, s.end)), "every slot inside opening hours");
ok(slots[0].start === zoned(d, "11:00", p.timezone), "first slot is 11:00 (right after the 9–11 event)");
// 3. Closed day (Sunday/Monday) gives nothing.
let sun = d; while (new Date(zoned(sun, "12:00", p.timezone)).toLocaleDateString("en-US", { weekday: "short", timeZone: p.timezone }) !== "Sun") sun = localDate(zoned(sun, "12:00", p.timezone) + 86400_000, p.timezone);
ok(openSlots(p, [], sun, sun, 60).length === 0, "closed day has no slots");
// 4. Multi-day range caps at 6 and spans days.
const many = openSlots(p, [], d, localDate(zoned(d, "12:00", p.timezone) + 4 * 86400_000, p.timezone), 30);
ok(many.length === 6 && new Set(many.map((s) => localDate(s.start, p.timezone))).size >= 2, "range: 6 slots across ≥2 days");
// 5. A slot running past closing is rejected; a 3.5 h balayage still fits a 9–19 day.
ok(!withinHours(p, zoned(d, "19:30", p.timezone), zoned(d, "20:30", p.timezone)), "slot past closing rejected");
ok(openSlots(p, [], d, d, 210).length > 0, "long 210-min service still fits");
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);

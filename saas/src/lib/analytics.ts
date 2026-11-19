import "server-only";
import { db } from "./db";
import type { Profile } from "./profile";

// Numbers for the Analytics page, worked out from this business's saved calls in its own time zone.

export const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days" } as const;
export type RangeKey = keyof typeof RANGES;
export const toRange = (v: unknown): RangeKey => (typeof v === "string" && v in RANGES ? (v as RangeKey) : "30");

type Row = { started_at: number; duration_ms: number | null; outcome: string; urgency: string; after_hours: number; service: string | null; reason: string | null };

const DAY = 86_400_000;
const OUTCOMES = ["Booked", "Order", "Request", "Message", "Info", "Spam"] as const;
const OUTCOME_LABEL: Record<string, string> = {
  Booked: "Booked an appointment",
  Order: "Placed an order",
  Request: "Asked for a booking",
  Message: "Left a message",
  Info: "Asked a question",
  Spam: "Spam or wrong number",
};

function partsIn(ms: number, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

// Free-text reasons grouped loosely: same words, different case or punctuation, count together.
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function analytics(businessId: string, profile: Profile, range: RangeKey) {
  const tz = profile.timezone;
  const days = Number(range);
  const end = Date.now();
  const start = end - days * DAY;
  const rows = db
    .prepare("SELECT started_at, duration_ms, outcome, urgency, after_hours, service, reason FROM calls WHERE business_id = ? AND started_at >= ? AND outcome != 'In progress'")
    .all(businessId, start - days * DAY) as Row[];
  const cur = rows.filter((r) => r.started_at >= start);
  const prev = rows.filter((r) => r.started_at < start);
  const real = cur.filter((r) => r.outcome !== "Spam");

  const talkMs = cur.reduce((s, r) => s + (r.duration_ms ?? 0), 0);
  const booked = cur.filter((r) => r.outcome === "Booked" || r.outcome === "Order").length;

  // One bucket per calendar day in the business's time zone, oldest first.
  const perDay: { ymd: string; label: string; short: string; count: number }[] = [];
  for (let k = days - 1; k >= 0; k--) {
    const ms = end - k * DAY;
    const ymd = partsIn(ms, tz).ymd;
    if (perDay.some((d) => d.ymd === ymd)) continue;
    perDay.push({
      ymd,
      label: new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }),
      short: new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: tz }),
      count: 0,
    });
  }
  const dayIndex = new Map(perDay.map((d, i) => [d.ymd, i]));
  const hours = Array.from({ length: 24 }, () => 0);
  for (const r of cur) {
    const p = partsIn(r.started_at, tz);
    const i = dayIndex.get(p.ymd);
    if (i !== undefined) perDay[i].count++;
    hours[p.hour]++;
  }

  // The widest open window across the week, for shading closed hours.
  const open = Object.values(profile.hours).filter(Boolean) as { open: string; close: string }[];
  const openFrom = open.length ? Math.min(...open.map((h) => Number(h.open.split(":")[0]))) : null;
  const openTo = open.length ? Math.max(...open.map((h) => Number(h.close.split(":")[0]) + (Number(h.close.split(":")[1]) > 0 ? 1 : 0))) : null;

  const outcomes = OUTCOMES.map((o) => ({ key: o, label: OUTCOME_LABEL[o], count: cur.filter((r) => r.outcome === o).length })).filter((o) => o.count).sort((a, z) => z.count - a.count);

  const topics = new Map<string, { label: string; count: number }>();
  for (const r of real) {
    const t = (r.service || r.reason || "").trim();
    if (!t) continue;
    const k = keyOf(t);
    const e = topics.get(k) ?? { label: t.charAt(0).toUpperCase() + t.slice(1), count: 0 };
    e.count++;
    topics.set(k, e);
  }

  return {
    range,
    total: cur.length,
    prevTotal: prev.length,
    spam: cur.length - real.length,
    booked,
    bookedRate: real.length ? Math.round((booked / real.length) * 100) : 0,
    afterHours: cur.filter((r) => r.after_hours).length,
    urgent: cur.filter((r) => r.urgency === "urgent").length,
    talkMin: Math.round(talkMs / 60000),
    avgMs: cur.length ? Math.round(talkMs / cur.length) : 0,
    perDay,
    hours,
    openFrom,
    openTo,
    outcomes,
    topics: [...topics.values()].sort((a, z) => z.count - a.count).slice(0, 6),
  };
}
export type Analytics = ReturnType<typeof analytics>;

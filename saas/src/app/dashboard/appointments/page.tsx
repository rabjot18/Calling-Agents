import { businessFor, requireUser } from "@/lib/auth";
import { listCalls, type CallRow } from "@/lib/calls";
import { PageHead } from "@/components/Dashboard";
import { AppointmentBook, type ApptGroup } from "@/components/Appointments";

const DAY = 86_400_000;
const WEEK = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const ymdIn = (ms: number, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(ms);
const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T12:00:00Z") + n * DAY).toISOString().slice(0, 10);
const longDate = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// Read the day and time a caller asked for out of what the receptionist wrote down ("Thursday 2:30 pm",
// "Tomorrow 11:00 am", "today 4:15 pm"), relative to the day they called. Anything vaguer stays unsettled.
function requested(c: CallRow, tz: string): { ymd: string | null; time: string | null; mins: number } {
  const text = (c.appointment_time ?? "").toLowerCase();
  const called = ymdIn(c.started_at, tz);
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const part = /morning/.test(text) ? "Morning" : /afternoon/.test(text) ? "Afternoon" : /evening/.test(text) ? "Evening" : null;
  const time = m ? `${Number(m[1])}${m[2] && m[2] !== "00" ? `:${m[2]}` : ""} ${m[3]}` : part;
  const mins = m ? ((Number(m[1]) % 12) + (m[3] === "pm" ? 12 : 0)) * 60 + Number(m[2] ?? 0) : part === "Morning" ? 540 : part === "Afternoon" ? 780 : part === "Evening" ? 1080 : 1440;
  if (/\bnext week\b/.test(text)) return { ymd: null, time, mins };
  if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(text)) return { ymd: called, time, mins };
  if (/\btomorrow\b/.test(text)) return { ymd: addDays(called, 1), time, mins };
  const w = WEEK.findIndex((d) => new RegExp(`\\b${d}\\b`).test(text));
  if (w >= 0) {
    const dow = new Date(called + "T12:00:00Z").getUTCDay();
    return { ymd: addDays(called, (w - dow + 7) % 7 || 7), time, mins };
  }
  return { ymd: null, time, mins };
}

export default async function AppointmentsPage() {
  const u = await requireUser();
  const b = businessFor(u.id);
  const tz = b.profile.timezone;
  const reqs = listCalls(b.id).filter((c) => c.outcome === "Booked" || c.outcome === "Request" || c.appointment_time);
  const today = ymdIn(Date.now(), tz);
  const tomorrow = addDays(today, 1);

  const byDay = new Map<string, { c: CallRow; time: string | null; mins: number }[]>();
  for (const c of reqs) {
    const r = requested(c, tz);
    const key = r.ymd === null ? "unsettled" : r.ymd < today ? "earlier" : r.ymd;
    byDay.set(key, [...(byDay.get(key) ?? []), { c, time: r.time, mins: r.mins }]);
  }
  const order = (k: string) => (k === "earlier" ? "0" : k === "unsettled" ? "9" : `1${k}`);
  const groups: ApptGroup[] = [...byDay]
    .sort(([a], [z]) => order(a).localeCompare(order(z)))
    .map(([key, items]) => ({
      key,
      label: key === "unsettled" ? "Day not settled" : key === "earlier" ? "Earlier" : key === today ? "Today" : key === tomorrow ? "Tomorrow" : longDate(key),
      sub: key === today || key === tomorrow ? longDate(key) : key === "unsettled" ? "call to agree a day" : key === "earlier" ? "dates already past" : undefined,
      items: items.sort((a, z) => a.mins - z.mins).map(({ c, time }) => ({ c, time })),
    }));
  const open = reqs.filter((c) => !c.done).length;

  return (
    <div>
      <PageHead title="Appointments"
        sub={reqs.length ? `${open} booking request${open === 1 ? "" : "s"} to confirm, filed under the day the caller asked for. Call back, then tick it off.` : `Booking requests ${b.profile.receptionist.name} takes land here.`} />
      <AppointmentBook groups={groups} timezone={tz} />
      <p className="small mt-8">Days are read from what the caller said. Live calendar booking arrives with calendar connections.</p>
    </div>
  );
}

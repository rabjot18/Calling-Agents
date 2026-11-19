import { businessFor, requireUser } from "@/lib/auth";
import { listCalls, type CallRow } from "@/lib/calls";
import { PageHead, SyncButton, WelcomeNote } from "@/components/Dashboard";
import { TodayDesk, type HourRow } from "@/components/Today";
import { tagOf } from "@/lib/callview";

// Date and time parts in the business's own time zone (the server may sit elsewhere).
function partsIn(ms: number, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute), day: String(p.weekday).toLowerCase().slice(0, 3) };
}
const toHour = (hhmm?: string) => (hhmm ? Number(hhmm.split(":")[0]) + (Number(hhmm.split(":")[1]) > 0 ? 1 : 0) : null);
const label = (h: number) => ({ n: h % 12 || 12, ap: h < 12 ? "am" : "pm" });

export default async function TodayPage({ searchParams }: PageProps<"/dashboard">) {
  const welcome = (await searchParams).welcome === "1";
  const u = await requireUser();
  const b = businessFor(u.id);
  const tz = b.profile.timezone;
  const name = b.profile.receptionist.name;
  const calls = listCalls(b.id);
  const now = partsIn(Date.now(), tz);

  const today = calls.filter((c) => partsIn(c.started_at, tz).ymd === now.ymd).sort((a, z) => a.started_at - z.started_at);
  const waiting = calls.filter((c) => !c.done && (c.follow_up || c.urgency === "urgent"));

  const hours = b.profile.hours[now.day as keyof typeof b.profile.hours] ?? null;
  const openH = hours ? Number(hours.open.split(":")[0]) : null;
  const closeH = hours ? toHour(hours.close) : null;
  const callHours = today.map((c) => partsIn(c.started_at, tz).hour);
  const first = Math.min(openH ?? 9, ...callHours);
  const last = Math.max((closeH ?? 18) - 1, ...callHours);
  const byHour = new Map<number, CallRow[]>();
  today.forEach((c, k) => byHour.set(callHours[k], [...(byHour.get(callHours[k]) ?? []), c]));
  const isClosed = (h: number) => openH === null || closeH === null || h < openH || h >= closeH;
  const rows: HourRow[] = Array.from({ length: last - first + 1 }, (_, k) => {
    const h = first + k;
    return { h, ...label(h), closed: isClosed(h), ids: (byHour.get(h) ?? []).map((c) => c.id) };
  });

  const counts = new Map<string, number>();
  today.forEach((c) => { const t = tagOf(c).label; counts.set(t, (counts.get(t) ?? 0) + 1); });
  const dateTitle = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
  const urgentWaiting = waiting.filter((c) => c.urgency === "urgent").length;

  return (
    <div>
      {welcome && <div className="mb-5"><WelcomeNote name={name} /></div>}
      <PageHead
        title={dateTitle}
        sub={
          today.length
            ? `${name} answered ${today.length} call${today.length === 1 ? "" : "s"} today.${waiting.length ? ` ${waiting.length} need${waiting.length === 1 ? "s" : ""} you${urgentWaiting ? `, ${urgentWaiting} urgent` : ""}.` : " Nothing is waiting on you."}`
            : `No calls yet today. ${hours ? `Open ${label(openH!).n}${label(openH!).ap} to ${hours.close.endsWith(":00") ? `${label(closeH!).n}${label(closeH!).ap}` : hours.close}.` : "Closed today."}`
        }>
        <SyncButton />
      </PageHead>
      <TodayDesk rows={rows} calls={today} waiting={waiting} counts={[...counts].sort((a, z) => z[1] - a[1])} agentName={name} timezone={tz} dateTitle={dateTitle} />
    </div>
  );
}

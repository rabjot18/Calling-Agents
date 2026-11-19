import Link from "next/link";
import { businessFor, requireUser } from "@/lib/auth";
import { analytics, RANGES, toRange, type Analytics } from "@/lib/analytics";
import { fmtDur } from "@/lib/callview";
import { PageHead, SyncButton } from "@/components/Dashboard";
import { Tally } from "@/components/Desk";
import type { Profile } from "@/lib/profile";

// Analytics: how the receptionist is doing over a chosen range. Server-rendered HTML bars (no chart library),
// one colour per chart, a hover label on every bar, and a table view under each chart.

const nice = (n: number) => {
  if (n <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= n) ?? n;
};
const fmtHour = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// Vertical columns from one baseline. `shade` marks slots drawn on a grey band (closed hours).
function Columns({ data, label, every, shade }: { data: { key: string; tick: string; tip: string; value: number }[]; label: string; every: number; shade?: (i: number) => boolean }) {
  const max = nice(Math.max(...data.map((d) => d.value), 1));
  return (
    <div className="an-chart" role="img" aria-label={label}>
      <div className="an-grid" aria-hidden="true">
        {[max, max / 2, 0].map((v) => (
          <div key={v} className="an-gridline"><span>{Number.isInteger(v) ? v : v.toFixed(1)}</span></div>
        ))}
      </div>
      <div className="an-cols" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d, i) => (
          <div key={d.key} className={`an-slot${shade?.(i) ? " an-shade" : ""}`}>
            {d.value > 0 && <div className="an-bar" style={{ height: `${(d.value / max) * 100}%`, ["--i" as string]: i }} />}
            <span className="an-tip" role="tooltip">{d.tip}</span>
          </div>
        ))}
      </div>
      <div className="an-ticks" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {data.map((d, i) => <span key={d.key}>{i % every === 0 ? d.tick : ""}</span>)}
      </div>
    </div>
  );
}

// Ranked horizontal bars with the value at the tip.
function Ranked({ rows, total }: { rows: { label: string; count: number }[]; total: number }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((r) => (
        <li key={r.label} className="min-w-0">
          <div className="flex justify-between gap-3 text-[14.5px]">
            <span className="truncate">{r.label}</span>
            <span className="tabular-nums text-[var(--muted)] shrink-0">{r.count} · {Math.round((r.count / total) * 100)}%</span>
          </div>
          <div className="an-track mt-1.5" aria-hidden="true"><div className="an-hbar" style={{ width: `${(r.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function TableView({ head, rows }: { head: [string, string]; rows: [string, number][] }) {
  return (
    <details className="mt-4">
      <summary className="small cursor-pointer select-none w-fit">Show as a table</summary>
      <table className="an-table mt-2">
        <thead><tr><th scope="col">{head[0]}</th><th scope="col">{head[1]}</th></tr></thead>
        <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
      </table>
    </details>
  );
}

// The month page: the range laid out as diary weeks, Monday first. Each day carries its calls as tally marks,
// days you're closed are hatched, and today is ringed in red pen. A day with calls opens that day in Call history.
const DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function MonthPage({ a, hours }: { a: Analytics; hours: Profile["hours"] }) {
  const mon = (ymd: string) => (new Date(ymd + "T12:00:00Z").getUTCDay() + 6) % 7;
  const shift = (ymd: string, d: number) => new Date(Date.parse(ymd + "T12:00:00Z") + d * 86_400_000).toISOString().slice(0, 10);
  const first = a.perDay[0].ymd;
  const last = a.perDay[a.perDay.length - 1].ymd;
  const counts = new Map(a.perDay.map((d) => [d.ymd, d]));
  const cells: string[] = [];
  for (let d = shift(first, -mon(first)); d <= shift(last, 6 - mon(last)); d = shift(d, 1)) cells.push(d);
  const max = Math.max(...a.perDay.map((d) => d.count), 1);
  const dense = cells.length > 42;
  return (
    <div className={`month ${dense ? "dense" : ""}`} role="grid" aria-label={`Calls per day, ${RANGES[a.range].toLowerCase()}`}>
      {WEEKDAY.map((w) => <div key={w} className="dow" role="columnheader">{w}</div>)}
      {cells.map((ymd, i) => {
        const d = counts.get(ymd);
        const date = new Date(ymd + "T12:00:00Z");
        const dom = date.getUTCDate();
        const showMonth = dom === 1 || i === 0;
        const closed = !hours[DOW[mon(ymd)]];
        const head = (
          <span className="num">
            {dom}{showMonth && <small>{date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</small>}
            {ymd === last && (
              <svg className="today-ring" viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true">
                <ellipse cx="30" cy="15" rx="27" ry="12" pathLength={100} fill="none" stroke="currentColor" strokeWidth="1.6" transform="rotate(-4 30 15)" />
              </svg>
            )}
          </span>
        );
        if (!d) return <div key={ymd} className="cell out" role="gridcell" aria-label={`${ymd}, outside this range`}>{head}</div>;
        const label = `${d.label}${ymd === last ? " (today)" : ""}: ${plural(d.count, "call")}${closed ? ", closed" : ""}`;
        const body = (
          <>
            {head}
            {d.count > 0 && !dense && d.count <= 10 && <Tally n={d.count} delay={i * 18} />}
            {d.count > 0 && <span className="count" style={{ opacity: 0.55 + 0.45 * (d.count / max) }}>{d.count}</span>}
          </>
        );
        return d.count > 0 ? (
          <Link key={ymd} href={`/dashboard/history?day=${ymd}`} className={`cell ${closed ? "closed" : ""}`} role="gridcell" aria-label={label} title={label}>{body}</Link>
        ) : (
          <div key={ymd} className={`cell ${closed ? "closed" : ""}`} role="gridcell" aria-label={label}>{body}</div>
        );
      })}
    </div>
  );
}

function Charts({ a, hours }: { a: Analytics; hours: Profile["hours"] }) {
  const busiest = a.perDay.reduce((m, d) => (d.count > m.count ? d : m), a.perDay[0]);
  const peakHour = a.hours.indexOf(Math.max(...a.hours));
  const closed = (h: number) => a.openFrom === null || a.openTo === null || h < a.openFrom || h >= a.openTo;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="sheet p-5 lg:col-span-2 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="h2">Calls per day</h2>
          <p className="small">Busiest: {busiest.label}, {plural(busiest.count, "call")}. Open a day to see its calls.</p>
        </div>
        <div className="mt-4"><MonthPage a={a} hours={hours} /></div>
        <TableView head={["Day", "Calls"]} rows={a.perDay.map((d) => [d.label, d.count])} />
      </section>

      <section className="sheet p-5 min-w-0">
        <h2 className="h2">What callers wanted</h2>
        <p className="small mt-0.5">How each call ended.</p>
        <div className="mt-5"><Ranked rows={a.outcomes} total={a.total} /></div>
      </section>

      <section className="sheet p-5 min-w-0">
        <h2 className="h2">Busiest hours</h2>
        <p className="small mt-0.5">
          Most calls come in around {fmtHour(peakHour)}.{a.openFrom !== null && " Shaded hours are when you're closed."}
        </p>
        <div className="mt-5">
          <Columns
            label={`Calls by hour of day. Peak around ${fmtHour(peakHour)}.`}
            every={3}
            shade={closed}
            data={a.hours.map((v, h) => ({ key: String(h), tick: fmtHour(h), tip: `${fmtHour(h)} to ${fmtHour((h + 1) % 24)}: ${plural(v, "call")}${closed(h) ? " (closed)" : ""}`, value: v }))}
          />
        </div>
        <TableView head={["Hour", "Calls"]} rows={a.hours.map((v, h) => [`${fmtHour(h)}${closed(h) ? " (closed)" : ""}`, v] as [string, number]).filter(([, v]) => v > 0)} />
      </section>

      <section className="sheet p-5 lg:col-span-2 min-w-0">
        <h2 className="h2">Most asked about</h2>
        <p className="small mt-0.5">The services, products and questions that come up most, spam left out.</p>
        <div className="mt-5">
          {a.topics.length ? <Ranked rows={a.topics} total={a.total - a.spam || 1} /> : <p className="small">Nothing yet. This fills in as callers ask about specific things.</p>}
        </div>
      </section>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const range = toRange((await searchParams).range);
  const u = await requireUser();
  const b = businessFor(u.id);
  const name = b.profile.receptionist.name;
  const a = analytics(b.id, b.profile, range);
  const change = a.total - a.prevTotal;

  return (
    <div>
      <PageHead title="Analytics" sub={a.total ? `${name} answered ${plural(a.total, "call")} in the ${RANGES[range].toLowerCase()}.` : `No calls in the ${RANGES[range].toLowerCase()} yet.`}>
        <SyncButton />
      </PageHead>

      <nav aria-label="Date range" className="flex flex-wrap gap-2 mb-6">
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => (
          <Link key={k} href={`/dashboard/analytics?range=${k}`} className="chip" aria-current={k === range ? "page" : undefined} aria-pressed={k === range}>
            {RANGES[k]}
          </Link>
        ))}
      </nav>

      {a.total > 0 && (
        <section aria-label="Summary" className="mb-8">
          <p className="ledger">
            {name} answered <b>{plural(a.total, "call")}</b>. <b>{a.booked}</b> ended in a booking or order
            {a.afterHours > 0 ? <>, <b>{a.afterHours}</b> came in while you were closed</> : null}, and {name} spent <b>{plural(a.talkMin, "minute")}</b> on the phone
            <span className="soft">, about {fmtDur(a.avgMs)} a call.</span>
          </p>
          <p className="small mt-3 !text-[14px]">
            {change === 0 ? `The same number of calls as the ${range} days before.` : `${Math.abs(change)} ${change > 0 ? "more" : "fewer"} than the ${range} days before.`}
            {" "}{a.bookedRate}% of real calls booked.{a.spam ? ` ${plural(a.spam, "spam call")} screened out.` : ""}
          </p>
        </section>
      )}

      {a.total ? (
        <Charts a={a} hours={b.profile.hours} />
      ) : (
        <section className="sheet p-8 text-center">
          <p className="h2">Nothing to chart yet</p>
          <p className="small mt-1.5 max-w-[46ch] mx-auto">
            Your numbers appear here after {name} answers calls. Call {name}&apos;s number (it&apos;s on the <Link href="/dashboard/settings" className="underline underline-offset-2 text-[var(--pen)]">Receptionist</Link> page) to try it, then press Check for new calls.
          </p>
        </section>
      )}
      {a.urgent > 0 && <p className="small mt-4">{plural(a.urgent, "urgent call")} in this period. See them in <Link href="/dashboard/calls" className="underline underline-offset-2 text-[var(--pen)]">Needs you</Link>.</p>}
    </div>
  );
}

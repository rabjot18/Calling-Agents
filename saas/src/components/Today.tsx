"use client";
// Today: the open book. The day page on the left, hours down the gutter, calls written on their lines.
// The facing page on the right holds what needs you and a tally of why people called; open a call
// and it takes the facing page instead. On phones the call slides up as a sheet.
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useEffect } from "react";
import type { CallRow } from "@/lib/calls";
import { fmtClock, fmtTime, relDay, tagOf, who } from "@/lib/callview";
import { CallDetail, useSheetLock } from "./Dashboard";
import { Tally, TickBox, UndoBar, useFresh, useKeys, useNow, useTriage, useUnread } from "./Desk";

export type HourRow = { h: number; n: number; ap: string; closed: boolean; ids: string[] };

export function TodayDesk({ rows, calls, waiting, counts, agentName, timezone, dateTitle }: {
  rows: HourRow[]; calls: CallRow[]; waiting: CallRow[]; counts: [string, number][]; agentName: string; timezone: string; dateTitle: string;
}) {
  const now = useNow(timezone);
  const triage = useTriage();
  const { isUnread, open } = useUnread();
  const fresh = useFresh(useMemo(() => calls.map((c) => c.id), [calls]));
  const [sel, setSel] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  useSheetLock(sheet && !!sel);

  const byId = useMemo(() => new Map([...calls, ...waiting].map((c) => [c.id, c])), [calls, waiting]);
  const current = sel ? byId.get(sel) : undefined;
  useEffect(() => { if (current) open(current.id); }, [current, open]);
  const select = (id: string) => { setSel(id); setSheet(true); };
  const close = () => { setSel(null); setSheet(false); };
  const move = (d: 1 | -1) => {
    if (!calls.length) return;
    const i = calls.findIndex((c) => c.id === sel);
    const next = calls[i === -1 ? (d > 0 ? 0 : calls.length - 1) : Math.max(0, Math.min(calls.length - 1, i + d))];
    setSel(next.id);
    document.querySelector(`[data-call="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
  };
  useKeys({
    j: () => move(1), k: () => move(-1),
    e: () => current && triage.mark(current, !triage.isTicked(current)),
    z: triage.undo,
    Escape: close,
  });

  const open_ = waiting.filter((c) => !triage.isDone(c));
  const cleared = waiting.length > 0 && open_.length === 0;

  return (
    <div className="grid gap-8 items-start lg:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-label={`Calls on ${dateTitle}`} className="sheet pr-3 py-2 min-w-0">
        <div className="day">
          {rows.map((r) => (
            <div key={r.h} className="contents">
              <div className={`hour ${r.closed ? "closed" : ""}`}>{r.n}<small>{r.ap}</small></div>
              <div className={`slot ${r.closed ? "closed" : ""}`}>
                {now && now.hour === r.h && (
                  <span className="now" style={{ top: `${(now.minute / 60) * 100}%`, transition: "top 600ms var(--ease-out)" }}
                    role="img" aria-label={`Now, ${now.label}`} />
                )}
                {r.ids.map((id) => {
                  const c = byId.get(id)!;
                  const t = tagOf(c);
                  const on = sel === id;
                  const done = triage.isTicked(c);
                  return (
                    <button key={id} type="button" data-call={id} aria-pressed={on} onClick={() => (on ? close() : select(id))}
                      className={`entry ${on ? "on" : ""} ${fresh.has(id) ? "fresh" : ""}`}>
                      {c.urgency === "urgent" && !done && <span className="ribbon" aria-hidden="true" />}
                      {isUnread(c) && !on && <span className="unread" aria-label="New" />}
                      <span className="t">{fmtClock(c.started_at, timezone)}</span>
                      <span className="who truncate">{who(c)}</span>
                      <span className={`tag ${t.cls}`}>{done && t.label === "Urgent" ? "Handled" : t.label}</span>
                      <span className="why">{c.reason || c.summary || "Summary on its way"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {!calls.length && (
          <p className="small px-4 pt-3 pb-2 ml-[64px]">
            When someone rings, the call is written in at its time. To see how it looks, call your receptionist&apos;s number (it&apos;s on the{" "}
            <Link href="/dashboard/settings" className="text-[var(--pen)] font-semibold underline">Receptionist</Link> tab), then press Check for new calls.
          </p>
        )}
      </section>

      <div className="min-w-0 order-first lg:order-none lg:sticky lg:top-6">
        <AnimatePresence mode="popLayout" initial={false}>
          {current && (
            <CallDetail key={current.id} c={current} agentName={agentName} timezone={timezone} done={triage.isTicked(current)}
              onDone={() => triage.mark(current, !triage.isTicked(current))} open={sheet} onBack={() => setSheet(false)} onClose={close}
              keys={[["J K", "next call"], ["E", "done"], ["Esc", "close"]]} />
          )}
        </AnimatePresence>

        <motion.aside className={`flex flex-col gap-8 ${current ? "lg:hidden" : ""}`} initial={false} animate={{ opacity: 1 }}>
          <section>
            <div className="flex items-baseline justify-between pb-2 border-b border-[var(--rule-strong)]">
              <h2 className="h2">Needs you</h2>
              <Link href="/dashboard/calls" className="text-sm font-semibold text-[var(--pen)]">See all</Link>
            </div>
            {open_.length || waiting.length ? (
              <ul className="ruled">
                <AnimatePresence initial={false}>
                  {open_.slice(0, 6).map((c) => {
                    const t = tagOf(c);
                    const ticked = triage.isTicked(c);
                    return (
                      <motion.li key={c.id} layout="position" className="overflow-hidden" exit={{ opacity: 0, height: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } }}>
                        <div className={`flex items-start gap-3 py-2.5 pl-0.5 ${ticked ? "struck" : ""}`}>
                          <span className="pt-0.5"><TickBox on={ticked} onToggle={() => triage.mark(c, !ticked)} label={`Mark ${who(c)} done`} /></span>
                          <button type="button" className="min-w-0 flex-1 text-left rounded-[4px]" onClick={() => select(c.id)}>
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="who font-semibold truncate">{who(c)}</span>
                              <span className={`tag ${t.cls}`}>{t.label}</span>
                            </span>
                            <span className="why block text-[14px] text-[var(--muted)] truncate">{relDay(c.started_at, timezone)}, {fmtTime(c.started_at, timezone)}. {c.reason || c.summary || "No summary yet"}</span>
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
                {cleared && (
                  <motion.li key="clear" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="py-4">
                    <p className="cond text-[19px] font-bold">All caught up.</p>
                    <p className="small">New urgent calls and call-backs land here first.</p>
                  </motion.li>
                )}
              </ul>
            ) : (
              <p className="small py-4">Nothing waiting. Urgent calls and call-back requests appear here.</p>
            )}
          </section>

          {counts.length > 0 && (
            <section className="max-lg:hidden">
              <h2 className="h2 pb-2 border-b border-[var(--rule-strong)]">Why people called today</h2>
              <ul className="ruled">
                {counts.map(([k, n], i) => (
                  <li key={k} className="flex items-center gap-3 py-2.5 text-[15px]">
                    <span className="flex-1">{k}</span>
                    <Tally n={n} delay={150 + i * 140} />
                    <span className="cond font-bold w-5 text-right">{n}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </motion.aside>
      </div>
      <UndoBar toast={triage.toast} onUndo={triage.undo} onClose={triage.dismiss} />
    </div>
  );
}

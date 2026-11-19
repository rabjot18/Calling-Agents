"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const noop = () => () => {};
import type { CallRow } from "@/lib/calls";
import { fmtDur, fmtPhone, fmtTime, relDay, tagOf, who } from "@/lib/callview";
import type { Profile } from "@/lib/profile";
import { AnimatePresence, motion } from "motion/react";
import { Connections, type ConnInfo } from "./Connections";
import { api, BookIcon, ChartIcon, CheckCalIcon, InboxIcon, Logo, PhoneIcon, SlidersIcon, TodayIcon, XIcon } from "./ui";
import { BackArrow, CommandBar, Keys, openFinder, SearchIcon, SyncStatus, TickBox, UndoBar, useFresh, useKeys, useTriage, useUnread } from "./Desk";

const LINKS = [
  { href: "/dashboard", label: "Today", short: "Today", icon: <TodayIcon /> },
  { href: "/dashboard/calls", label: "Needs you", short: "Needs you", icon: <InboxIcon />, badge: true },
  { href: "/dashboard/history", label: "Call history", short: "History", icon: <BookIcon /> },
  { href: "/dashboard/appointments", label: "Appointments", short: "Bookings", icon: <CheckCalIcon /> },
  { href: "/dashboard/analytics", label: "Analytics", short: "Analytics", icon: <ChartIcon /> },
  { href: "/dashboard/settings", label: "Receptionist", short: "Settings", icon: <SlidersIcon /> },
];

export function Nav({ business, agentName, live, needs = 0, urgent = 0, timezone }: { business: string; agentName: string; live: boolean; needs?: number; urgent?: number; timezone: string }) {
  const path = usePathname();
  const router = useRouter();
  const mac = useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform), () => true);
  const badge = (b?: boolean) => (b && needs > 0 ? <span className={`badge ${urgent ? "hot" : ""}`} aria-label={`${needs} waiting${urgent ? `, ${urgent} urgent` : ""}`}>{needs}</span> : null);
  const dot = <span className={`w-2 h-2 rounded-full shrink-0 ${live ? "bg-[#7fd1a4]" : "bg-[#e3b55b]"}`} aria-hidden="true" />;
  return (
    <>
      <nav aria-label="Main" className="rail cloth-tex">
        <div className="px-3 pb-5 shrink-0 max-[860px]:p-0"><Logo light size={20} /></div>
        <div className="flex items-center gap-1 min-[861px]:hidden">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--cloth-ink)] pr-1">{dot}{live ? `${agentName} is answering` : "Test mode"}</span>
          <button type="button" className="top-find" onClick={openFinder} aria-label="Find a call or page"><SearchIcon size={20} /></button>
        </div>
        <button type="button" className="find" onClick={openFinder}><SearchIcon />Find a call<kbd>{mac ? "⌘K" : "Ctrl K"}</kbd></button>
        <div className="rail-links flex flex-col gap-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav" aria-current={path === l.href ? "page" : undefined}>
              {l.icon}
              {l.label}
              {badge(l.badge)}
            </Link>
          ))}
        </div>
        <div className="rail-foot mt-auto px-3 pt-4 border-t border-[var(--cloth-2)] text-sm">
          <p className="flex items-center gap-2 font-semibold">{dot}{live ? `${agentName} is answering` : `${agentName} is in test mode`}</p>
          <p className="mt-0.5 text-[var(--cloth-muted)] truncate">{business}</p>
          <button className="mt-3 text-[var(--cloth-muted)] hover:text-white underline underline-offset-2"
            onClick={async () => { await fetch("/api/auth/login", { method: "DELETE" }); router.replace("/"); }}>
            Sign out
          </button>
        </div>
      </nav>
      <nav aria-label="Main" className="tabbar">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>
            {l.icon}
            {l.short}
            {badge(l.badge)}
          </Link>
        ))}
      </nav>
      <CommandBar timezone={timezone} />
    </>
  );
}

// Kept under its old name: the page head's sync control, which now checks by itself.
export const SyncButton = SyncStatus;

// One quiet note after setup, instead of a celebration. Clears ?welcome=1 so it doesn't come back.
export function WelcomeNote({ name }: { name: string }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.has("welcome")) {
      u.searchParams.delete("welcome");
      window.history.replaceState(null, "", u);
    }
  }, []);
  if (!open) return null;
  return (
    <div className="rise flex items-start gap-3 rounded-[8px] bg-[var(--ok-bg)] text-[var(--ink)] px-4 py-3">
      <p className="flex-1 text-[15px]"><b className="text-[var(--ok)]">{name} is set up.</b> Every call gets written onto this page. Try one from the Receptionist tab.</p>
      <button className="text-[var(--muted)] p-1" aria-label="Dismiss" onClick={() => setOpen(false)}><XIcon /></button>
    </div>
  );
}

// A ruled list of calls, used on the side panels.
export function CallList({ calls, showAppointment, timezone }: { calls: CallRow[]; showAppointment?: boolean; timezone?: string }) {
  return (
    <ul className="ruled">
      {calls.map((c) => {
        const t = tagOf(c);
        const urgent = c.urgency === "urgent" && !c.done;
        return (
          <li key={c.id}>
            <Link href={`/dashboard/history?call=${c.id}`} className="entry">
              {urgent && <span className="ribbon" aria-hidden="true" />}
              <span className="t">{relDay(c.started_at, timezone)}</span>
              <span className="who truncate">{who(c)}</span>
              <span className={`tag ${t.cls}`}>{t.label}</span>
              <span className="why truncate">
                {fmtTime(c.started_at, timezone)}.{" "}
                {showAppointment && (c.service || c.appointment_time) ? [c.service, c.appointment_time].filter(Boolean).join(", ") : c.reason || c.summary || "No summary yet"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-5 mb-6 border-b border-[var(--rule-strong)]">
      <div className="min-w-0">
        <h1 className="h1">{title}</h1>
        {sub && <p className="sub mt-1">{sub}</p>}
      </div>
      {children}
    </header>
  );
}

// Lock the page behind an open call sheet on small screens.
export function useSheetLock(open: boolean) {
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 1023px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
}

type Range = "today" | "yesterday" | "7d" | "30d" | "all" | "custom";
export function CallBrowser({ calls, mode, agentName, timezone }: { calls: CallRow[]; mode: "inbox" | "history"; agentName: string; timezone: string }) {
  const sp = useSearchParams();
  const initialSel = sp.get("call");
  const initialDay = sp.get("day");
  const [range, setRange] = useState<Range>(initialDay ? "custom" : mode === "inbox" || initialSel ? "all" : "7d");
  const [from, setFrom] = useState(initialDay ?? "");
  const [to, setTo] = useState(initialDay ?? "");
  const [time, setTime] = useState<"any" | "open" | "after">("any");
  const [outcome, setOutcome] = useState("all");
  const [onlyOpen, setOnlyOpen] = useState(mode === "inbox");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [sel, setSel] = useState<string | null>(initialSel);
  const [sheet, setSheet] = useState(!!initialSel);
  const triage = useTriage();
  const { isUnread, open } = useUnread();
  const fresh = useFresh(useMemo(() => calls.map((c) => c.id), [calls]));
  const search = useRef<HTMLInputElement>(null);
  useSheetLock(sheet);

  const filtered = useMemo(() => {
    const day = 86400000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const t0 = today.getTime();
    const [lo, hi] =
      range === "today" ? [t0, Infinity] : range === "yesterday" ? [t0 - day, t0] : range === "7d" ? [t0 - 6 * day, Infinity] : range === "30d" ? [t0 - 29 * day, Infinity]
        : range === "custom" ? [from ? new Date(from + "T00:00").getTime() : 0, to ? new Date(to + "T00:00").getTime() + day : Infinity] : [0, Infinity];
    const needle = q.trim().toLowerCase();
    return calls.filter((c) => {
      if (c.started_at < lo || c.started_at >= hi) return false;
      if (time !== "any" && (time === "after") !== !!c.after_hours) return false;
      if (outcome !== "all" && (outcome === "Urgent" ? c.urgency !== "urgent" : c.outcome !== outcome)) return false;
      if (onlyOpen && (triage.isDone(c) || !(c.follow_up || c.urgency === "urgent"))) return false;
      if (needle && ![who(c), c.from_number, c.reason, c.summary, c.transcript_json].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [calls, range, from, to, time, outcome, onlyOpen, q, triage]);

  const groups = useMemo(() => {
    const m = new Map<string, CallRow[]>();
    for (const c of filtered) {
      const k = new Date(c.started_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: timezone });
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return [...m];
  }, [filtered, timezone]);
  const flat = useMemo(() => groups.flatMap(([, r]) => r), [groups]);
  const current = calls.find((c) => c.id === sel) ?? flat[0];
  useEffect(() => { if (current) open(current.id); }, [current, open]);

  function select(id: string, asSheet = true) {
    setSel(id);
    if (asSheet) setSheet(true);
    const u = new URL(window.location.href);
    u.searchParams.set("call", id);
    window.history.replaceState(null, "", u);
    document.querySelector(`[data-call="${id}"]`)?.scrollIntoView({ block: "nearest" });
  }
  function move(d: 1 | -1) {
    if (!flat.length) return;
    const i = flat.findIndex((c) => c.id === current?.id);
    const next = flat[Math.max(0, Math.min(flat.length - 1, i + d))];
    if (next) select(next.id, false);
  }
  // In the inbox, finishing a call moves you on to the next one, like clearing mail.
  function toggleDone(c: CallRow) {
    const on = !triage.isTicked(c);
    triage.mark(c, on);
    if (on && mode === "inbox") {
      const i = flat.findIndex((x) => x.id === c.id);
      const next = flat[i + 1] ?? flat[i - 1];
      window.setTimeout(() => { if (next) setSel(next.id); }, 720);
    }
  }
  useKeys({
    j: () => move(1), ArrowDown: () => move(1), k: () => move(-1), ArrowUp: () => move(-1),
    e: () => current && toggleDone(current),
    z: triage.undo,
    c: () => { if (current?.from_number) window.location.href = `tel:${current.from_number}`; },
    "/": () => search.current?.focus(),
    Escape: () => setSheet(false),
  });
  const chip = (on: boolean) => ({ "aria-pressed": on, className: "chip" });

  return (
    <div>
      <PageHead title={mode === "inbox" ? "Needs you" : "Call history"}
        sub={mode === "inbox" ? "Urgent calls and anyone waiting for a call back. Tick them off as you go." : "Every call, by day. Search what anyone said."}>
        <SyncStatus />
      </PageHead>

      <section className="flex flex-col gap-3 mb-6">
        <div className="relative max-w-[520px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)] pointer-events-none"><SearchIcon /></span>
          <input ref={search} className="field !pl-9 !pr-10" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, numbers, or anything said on a call" aria-label="Search calls" />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 max-[860px]:hidden" aria-hidden="true">/</kbd>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
          <div role="group" aria-label="When" className="flex flex-wrap gap-1.5 items-center">
            {([["today", "Today"], ["yesterday", "Yesterday"], ["7d", "7 days"], ["30d", "30 days"], ["all", "All"], ["custom", "Pick dates"]] as [Range, string][]).map(([k, l]) => (
              <button key={k} {...chip(range === k)} onClick={() => setRange(k)}>{l}</button>
            ))}
          </div>
          {range === "custom" && (
            <div className="flex gap-2 items-center text-sm">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field !min-h-[34px] !w-auto" aria-label="From date" />
              to
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field !min-h-[34px] !w-auto" aria-label="To date" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            Time
            <select className="field !min-h-[34px] !w-auto text-sm" value={time} onChange={(e) => setTime(e.target.value as typeof time)}>
              <option value="any">Any time</option><option value="open">While open</option><option value="after">After hours</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            Outcome
            <select className="field !min-h-[34px] !w-auto text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {["all", "Urgent", "Request", "Booked", "Message", "Order", "Spam"].map((k) => <option key={k} value={k}>{k === "all" ? "All" : k}</option>)}
            </select>
          </label>
          {mode === "inbox" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Only open</label>}
        </div>
      </section>

      <div className="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <section aria-label="Calls by day" className="min-w-0">
          <p className="small mb-2">{filtered.length} call{filtered.length === 1 ? "" : "s"}{q ? ` mentioning "${q}"` : ""}</p>
          {!filtered.length && (
            <div className="sheet px-5 py-8">
              <p className="h3">{calls.length ? (mode === "inbox" && onlyOpen && !q ? "All caught up" : "No calls match these filters") : mode === "inbox" ? "Nothing needs you" : "No calls yet"}</p>
              <p className="small mt-1">{calls.length ? (mode === "inbox" && onlyOpen && !q ? "Every urgent call and call-back is ticked off. New ones land here first." : "Try a wider date range or clear the search.") : "Calls appear here after someone rings your receptionist's number."}</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {groups.map(([day, rows]) => (
              <motion.div key={day} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="mb-6">
                <div className="flex justify-between items-baseline pb-1.5 border-b border-[var(--rule-strong)]">
                  <h2 className="cond text-[19px] font-bold">{day}</h2>
                  <span className="small">{rows.length} call{rows.length === 1 ? "" : "s"}</span>
                </div>
                <div className="ruled">
                  <AnimatePresence initial={false}>
                    {rows.map((c) => {
                      const t = tagOf(c);
                      const on = current?.id === c.id;
                      const ticked = triage.isTicked(c);
                      return (
                        <motion.div key={c.id} layout="position" className="flex items-center gap-1 overflow-hidden" data-call={c.id}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } }} transition={{ duration: 0.18 }}>
                          {mode === "inbox" && <span className="pl-2"><TickBox on={ticked} onToggle={() => toggleDone(c)} label={`Mark ${who(c)} done`} /></span>}
                          <button onClick={() => select(c.id)} aria-pressed={on}
                            className={`entry relative isolate flex-1 min-w-0 !rounded-none ${fresh.has(c.id) ? "fresh" : ""} ${ticked && mode === "inbox" ? "struck" : ""}`}>
                            {on && <motion.span layoutId="sel-row" className="absolute inset-0 -z-10 bg-[var(--pen-bg)]" transition={{ type: "spring", stiffness: 600, damping: 45 }} />}
                            {c.urgency === "urgent" && !ticked && mode !== "inbox" && <span className="ribbon" aria-hidden="true" />}
                            {isUnread(c) && !on && <span className="unread" aria-label="New" />}
                            <span className="t">{fmtTime(c.started_at, timezone)}</span>
                            <span className="who truncate">{who(c)}</span>
                            <span className="flex items-center gap-3"><span className={`tag ${t.cls}`}>{ticked && t.label === "Urgent" ? "Handled" : t.label}</span><span className="small w-9 text-right max-[560px]:hidden">{fmtDur(c.duration_ms)}</span></span>
                            <span className="why truncate">{c.reason || c.summary || "No summary yet"}</span>
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
        {current && (
          <CallDetail key={current.id} c={current} agentName={agentName} timezone={timezone} done={triage.isTicked(current)} onDone={() => toggleDone(current)}
            open={sheet} onBack={() => setSheet(false)}
            keys={[["J K", "move"], ["E", "done"], ["C", "call back"], ["/", "search"]]} />
        )}
      </div>
      <UndoBar toast={triage.toast} onUndo={triage.undo} onClose={triage.dismiss} />
    </div>
  );
}

// One call, opened. On wide screens it sits beside the list (the facing page); on phones it slides up as a sheet.
export function CallDetail({ c, agentName, timezone, done, onDone, open, onBack, onClose, keys }: {
  c: CallRow; agentName: string; timezone: string; done: boolean; onDone: () => void;
  open: boolean; onBack: () => void; onClose?: () => void; keys?: [string, string][];
}) {
  const lines = (c.transcript_json ? JSON.parse(c.transcript_json) : []) as { who: string; text: string; at: number }[];
  const t = tagOf(c);
  const when = `${new Date(c.started_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: timezone })}, ${fmtTime(c.started_at, timezone)}`;
  const urgent = c.urgency === "urgent" && !done;
  return (
    <motion.section aria-label={`Call from ${who(c)}`} data-open={open} className="sheet facing detail-sheet min-w-0 lg:sticky lg:top-6"
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
      <button type="button" className="sheet-back" onClick={onBack}><BackArrow />Back</button>
      <div className="p-5 border-b border-[var(--rule)] relative">
        {urgent && <span className="absolute right-14 -top-px w-3 h-11 bg-[var(--ribbon)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)]" aria-hidden="true" />}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close this call" className="facing-close absolute right-3 top-3 p-1.5 rounded-[6px] text-[var(--muted)] hover:bg-[var(--paper-2)]"><XIcon /></button>
        )}
        <p className="small pr-10">{when}</p>
        <h2 className="cond text-[28px] font-bold leading-tight mt-0.5 pr-16">{who(c)}</h2>
        <p className="small mt-0.5">{[fmtPhone(c.from_number), fmtDur(c.duration_ms), c.after_hours ? "after hours" : "during opening hours"].filter(Boolean).join(", ")}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`tag ${t.cls}`}>{done && t.label === "Urgent" ? "Handled" : t.label}</span>
          {c.follow_up ? <span className="tag tag-Message">Wants a call back</span> : null}
        </div>
        <p className="mt-4 text-[15.5px] leading-relaxed">{c.summary || "The summary appears a minute or so after the call ends."}</p>
        {(c.service || c.appointment_time) && <p className="mt-2 text-[15px]"><b>Requested:</b> {[c.service, c.appointment_time].filter(Boolean).join(", ")}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {c.from_number && <a href={`tel:${c.from_number}`} className="btn"><PhoneIcon />Call back</a>}
          <button className="btn btn-soft" onClick={onDone} aria-pressed={done}>
            <span className="tickbox !w-[18px] !h-[18px] pointer-events-none" aria-hidden="true" aria-checked={done}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            {done ? "Done" : "Mark done"}
          </button>
        </div>
        {c.recording_url && <audio className="mt-4 w-full" controls src={c.recording_url} preload="none" />}
      </div>
      <div className="p-5">
        <h3 className="h3">Transcript</h3>
        {lines.length ? (
          <ol className="mt-2 ruled lg:max-h-[440px] overflow-auto pr-1">
            {lines.map((l, k) => (
              <li key={k} className="py-2 grid grid-cols-[56px_minmax(0,1fr)] gap-3 text-[14.5px] leading-relaxed">
                <span className="cond font-semibold text-[13px] pt-0.5 text-[var(--muted)]">{l.who === "agent" ? agentName : "Caller"}</span>
                <span className={l.who === "agent" ? "" : "text-[var(--pen)]"}>{l.text}</span>
              </li>
            ))}
          </ol>
        ) : <p className="small mt-1">No transcript yet.</p>}
        {keys && <div className="mt-5 pt-4 border-t border-[var(--rule)]"><Keys items={keys} /></div>}
      </div>
    </motion.section>
  );
}

// The receptionist's real phone line: buy one (test-mode businesses skipped this in setup), or show it with forwarding help.
function PhoneLine({ name, phone, live, free }: { name: string; phone: string | null; live: boolean; free: boolean }) {
  const router = useRouter();
  const [country, setCountry] = useState<"US" | "CA">(free ? "US" : "CA");
  const [area, setArea] = useState("");
  const [confirm, setConfirm] = useState(free);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (phone && live)
    return (
      <section className="sheet p-5">
        <h2 className="h2">{name}&apos;s number</h2>
        <a href={`tel:${phone}`} className="cond block text-[30px] font-bold mt-1 text-[var(--pen)]">{fmtPhone(phone)}</a>
        <p className="small mt-2">Call it from your mobile to test. To use it for your business, forward your usual line here: on most mobiles dial <b>*72</b> then this number.</p>
      </section>
    );
  async function get() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/golive", { method: "POST", json: { country, areaCode: area, confirmPurchase: true } });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't get a number");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sheet p-5 flex flex-col gap-3">
      <h2 className="h2">Get a phone number</h2>
      <p className="small -mt-2">{free ? `A free US number for ${name}. Call it from any phone; from Canada it may count as long distance on some plans.` : `Gives ${name} a real number you can call from any phone, and turns ${name} on.`}</p>
      {!free && (
        <div className="flex gap-2">
          {(["CA", "US"] as const).map((c) => <button key={c} type="button" className="chip" aria-pressed={country === c} onClick={() => setCountry(c)}>{c === "US" ? "United States" : "Canada"}</button>)}
        </div>
      )}
      {country === "US" && <input className="field" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Area code you'd like (optional)" inputMode="numeric" aria-label="Area code" />}
      {!free && (
        <label className="flex gap-2 items-start text-sm">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
          I understand this adds a phone number (about $2/month).
        </label>
      )}
      <button className="btn" disabled={busy || !confirm} onClick={get}>{busy ? "Getting your number…" : `Get ${name} a number`}</button>
      {free && <p className="small">New numbers take about two minutes to start answering.</p>}
      {err && <p className="text-[14px] text-[var(--ribbon)]" role="alert">{err}</p>}
    </section>
  );
}

export function SettingsView({ profile, phone, status, connections, accountEmail, freeNumber = false }: { profile: Profile; phone: string | null; status: string; connections: ConnInfo; accountEmail: string; freeNumber?: boolean }) {
  const router = useRouter();
  const [extra, setExtra] = useState(profile.extra);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const name = profile.receptionist.name;
  async function teach(body: { text?: string; remove?: number }) {
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ profile: Profile }>("/api/teach", { method: "POST", json: body });
      setExtra(r.profile.extra);
      setText("");
      setMsg(`${name} is updated.`);
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't update"); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <PageHead title={name} sub={`${profile.receptionist.voiceLabel ?? "Voice not chosen"}${phone ? `, answering ${fmtPhone(phone)}` : ""}. ${status === "live" ? "Live." : "Test mode: no phone number yet."}`} />
      <div className="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6 min-w-0">
          <section className="sheet p-5">
            <h2 className="h2">Tell {name} something new</h2>
            <p className="small mt-0.5">Changes take effect on the next call.</p>
            <form className="mt-4 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) teach({ text }); }}>
              <input className="field flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="We're closed 24 to 26 December" aria-label="New instruction" />
              <button className="btn" disabled={busy}>{busy ? "Updating…" : "Teach"}</button>
            </form>
            {msg && <p className="mt-2 text-sm text-[var(--ok)]" aria-live="polite">{msg}</p>}
          </section>
          <div>
            <h2 className="h2 mb-3">Connections</h2>
            <Connections initial={connections} returnTo="/dashboard/settings" agentName={name} notifyEmail={profile.notifyEmail ?? ""} notifyWhatsApp={profile.notifyWhatsApp ?? ""} accountEmail={accountEmail} />
          </div>
          <section className="sheet">
            <h2 className="h2 px-5 pt-5 pb-2">What {name} knows beyond setup</h2>
            <ul className="ruled border-t border-[var(--rule)]">
              {extra.length ? extra.map((e, k) => (
                <li key={k} className="flex justify-between gap-3 items-start px-5 py-3 text-[15px]">
                  <span>{e}</span>
                  <button className="text-[var(--muted)] hover:text-[var(--ribbon)] shrink-0 p-1" aria-label={`Remove: ${e}`} disabled={busy} onClick={() => teach({ remove: k })}><XIcon /></button>
                </li>
              )) : <li className="px-5 py-4 small">Nothing extra yet. Anything you teach shows up here.</li>}
            </ul>
            <p className="px-5 py-3 small border-t border-[var(--rule)]">Plus your hours, {profile.catalog.length} items and everything from setup.</p>
          </section>
        </div>
        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <PhoneLine name={name} phone={phone} live={status === "live"} free={freeNumber} />
        </div>
      </div>
    </div>
  );
}

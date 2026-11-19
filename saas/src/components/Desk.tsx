"use client";
// The desk: shared pieces for the signed-in app. Auto-checking for calls, the pen tick, tally marks,
// the undo bar, keyboard triage, the ⌘K command bar, and "new" / "unread" marks on calls.
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CallRow } from "@/lib/calls";
import { fmtPhone, relDay, who } from "@/lib/callview";
import { api, XIcon } from "./ui";

const Svg = ({ children, size = 16, className }: { children: ReactNode; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    {children}
  </svg>
);
export const RefreshIcon = ({ spin }: { spin?: boolean }) => <Svg className={spin ? "spin" : undefined}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></Svg>;
export const SearchIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Svg>;
export const BackArrow = () => <Svg size={18}><path d="M15 18l-6-6 6-6" /></Svg>;

// ───────── checking for calls by itself ─────────
// Pulls new calls when the page opens, every minute while the tab is visible, and when the owner comes back to it.
export function SyncStatus() {
  const router = useRouter();
  const [last, setLast] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const running = useRef(false);
  const lastRef = useRef(0);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const r = await api<{ added: number }>("/api/calls", { method: "POST" });
      setErr("");
      if (r.added) router.refresh();
    } catch {
      setErr("Couldn't reach the phone line");
    } finally {
      lastRef.current = Date.now();
      setLast(lastRef.current);
      setClock(lastRef.current);
      setBusy(false);
      running.current = false;
    }
  }, [router]);

  useEffect(() => {
    const first = window.setTimeout(run, 250);
    const every = window.setInterval(() => { if (document.visibilityState === "visible") run(); }, 60_000);
    const back = () => { if (document.visibilityState === "visible" && Date.now() - lastRef.current > 30_000) run(); };
    const tick = window.setInterval(() => setClock(Date.now()), 20_000);
    document.addEventListener("visibilitychange", back);
    return () => { clearTimeout(first); clearInterval(every); clearInterval(tick); document.removeEventListener("visibilitychange", back); };
  }, [run]);

  const ago = last === null ? "" : clock - last < 45_000 ? "just now" : `${Math.round((clock - last) / 60_000)} min ago`;
  return (
    <div className="sync">
      <span className={`dot ${busy ? "busy" : err ? "err" : ""}`} aria-hidden="true" />
      <span aria-live="polite">{last === null ? "Checking for calls" : err ? `${err}. Checked ${ago}` : busy ? "Checking…" : `Up to date, checked ${ago}`}</span>
      <button type="button" onClick={run} aria-label="Check for new calls now" title="Check for new calls now" disabled={busy}><RefreshIcon spin={busy} /></button>
    </div>
  );
}

// ───────── the clock, in the business's own time zone ─────────
// Re-reads every 30 seconds. On the server (and the first paint) it is null, so nothing time-bound renders until the browser knows the time.
const everyHalfMinute = (cb: () => void) => { const t = window.setInterval(cb, 30_000); return () => clearInterval(t); };
export function useNow(timeZone: string) {
  const snap = useSyncExternalStore(
    everyHalfMinute,
    () => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(Date.now()),
    () => ""
  );
  return useMemo(() => {
    if (!snap) return null;
    const [h, m] = snap.split(":").map(Number);
    const hour = h % 24;
    return { hour, minute: m, label: `${hour % 12 || 12}:${String(m).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}` };
  }, [snap]);
}

// ───────── new and unread ─────────
// "Fresh": calls that arrived while the page was open; they ink in. "Unread": calls from the last day not yet opened.
export function useFresh(ids: string[]) {
  const key = ids.join(",");
  const [prev, setPrev] = useState(key);
  const [seen, setSeen] = useState(() => new Set(ids));
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  if (key !== prev) {
    setPrev(key);
    const added = ids.filter((i) => !seen.has(i));
    if (added.length) { setSeen(new Set([...seen, ...added])); setFresh(new Set(added)); }
  }
  return fresh;
}

const OPENED = "pulse:opened";
const SEEN = "pulse:last-visit";
const openedListeners = new Set<() => void>();
const readOpened = () => { try { return localStorage.getItem(OPENED) ?? "[]"; } catch { return "[]"; } };
// The previous visit's time, read once per page load. The first visit ever counts as now, so nothing starts out "new".
let lastVisit: number | null = null;
const readLastVisit = () => {
  if (lastVisit === null) {
    try { lastVisit = Number(localStorage.getItem(SEEN)) || Date.now(); } catch { lastVisit = Date.now(); }
    const save = () => { try { localStorage.setItem(SEEN, String(Date.now())); } catch {} };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });
  }
  return lastVisit;
};
export function useUnread() {
  const raw = useSyncExternalStore(
    (cb) => { openedListeners.add(cb); return () => { openedListeners.delete(cb); }; },
    readOpened,
    () => null
  );
  const since = useSyncExternalStore(noopSubscribe, readLastVisit, () => Infinity);
  const opened = useMemo(() => { if (raw === null) return null; try { return new Set<string>(JSON.parse(raw)); } catch { return new Set<string>(); } }, [raw]);
  const open = useCallback((id: string) => {
    const s = new Set<string>(JSON.parse(readOpened()));
    if (s.has(id)) return;
    s.add(id);
    try { localStorage.setItem(OPENED, JSON.stringify([...s].slice(-600))); } catch {}
    openedListeners.forEach((l) => l());
  }, []);
  // New since the last visit, and not opened yet.
  const isUnread = useCallback((c: CallRow) => !!opened && !opened.has(c.id) && c.started_at > since, [opened, since]);
  return { isUnread, open };
}
const noopSubscribe = () => () => {};

// ───────── keyboard ─────────
// Single-key shortcuts, ignored while typing. Escape in a field just leaves the field.
export function useKeys(map: Record<string, (e: KeyboardEvent) => void>) {
  const ref = useRef(map);
  useEffect(() => { ref.current = map; });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) {
        if (e.key === "Escape" && t.closest("input, textarea")) (t as HTMLElement).blur();
        return;
      }
      const f = ref.current[e.key];
      if (f) { e.preventDefault(); f(e); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
}

export function Keys({ items }: { items: [string, string][] }) {
  return (
    <p className="keys" aria-hidden="true">
      {items.map(([k, l]) => <span key={l}>{k.split(" ").map((x) => <kbd key={x}>{x}</kbd>)}{l}</span>)}
    </p>
  );
}

// ───────── done: the pen tick, with undo ─────────
export function TickBox({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} className="tickbox" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

// Marking done draws the tick at once, strikes the name through, and saves after the stroke lands,
// so a slip can be undone from the bar (or with Z) before anything moves.
export function useTriage(verb = "marked done") {
  const router = useRouter();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [gone, setGone] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ id: string; text: string; n: number } | null>(null);
  const pending = useRef<Record<string, number>>({});

  const save = useCallback((id: string, done: boolean) => {
    api("/api/calls", { method: "PATCH", json: { id, done } }).then(() => router.refresh()).catch(() => {});
  }, [router]);

  const mark = useCallback((c: CallRow, done: boolean) => {
    clearTimeout(pending.current[c.id]);
    delete pending.current[c.id];
    setTicked((t) => ({ ...t, [c.id]: done }));
    if (done) {
      pending.current[c.id] = window.setTimeout(() => {
        delete pending.current[c.id];
        setGone((g) => ({ ...g, [c.id]: true }));
        save(c.id, true);
      }, 700);
      setToast((t) => ({ id: c.id, text: `${who(c)} ${verb}.`, n: (t?.n ?? 0) + 1 }));
    } else {
      setGone((g) => ({ ...g, [c.id]: false }));
      save(c.id, false);
    }
  }, [save, verb]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  // Leaving the page mid-stroke still saves.
  useEffect(() => () => { for (const id of Object.keys(pending.current)) { clearTimeout(pending.current[id]); api("/api/calls", { method: "PATCH", json: { id, done: true } }).catch(() => {}); } }, []);

  const isTicked = (c: CallRow) => ticked[c.id] ?? !!c.done;
  const isDone = (c: CallRow) => gone[c.id] ?? !!c.done;
  const undo = () => {
    if (!toast) return;
    const id = toast.id;
    setToast(null);
    clearTimeout(pending.current[id]);
    const wasPending = id in pending.current;
    delete pending.current[id];
    setTicked((t) => ({ ...t, [id]: false }));
    setGone((g) => ({ ...g, [id]: false }));
    if (!wasPending) save(id, false);
  };
  return { mark, isTicked, isDone, toast, undo, dismiss: () => setToast(null) };
}

export function UndoBar({ toast, onUndo, onClose }: { toast: { text: string; n: number } | null; onUndo: () => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div key={toast.n} role="status" className="toast" initial={{ opacity: 0, y: 14, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 8, x: "-50%", transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 520, damping: 38 }}>
          <span>{toast.text}</span>
          <button type="button" onClick={onUndo}>Undo <kbd className="!bg-transparent !border-[var(--cloth-3)] !text-[var(--cloth-ink)] ml-1">Z</kbd></button>
          <button type="button" onClick={onClose} aria-label="Dismiss" className="!border-0 !px-1.5 grid place-items-center"><XIcon /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ───────── tally marks ─────────
// Counted the way you would on a pad: four strokes and a bar across. The strokes draw in, one after another.
export function Tally({ n, delay = 0, max = 20 }: { n: number; delay?: number; max?: number }) {
  const shown = Math.min(n, max);
  const groups = Array.from({ length: Math.ceil(shown / 5) }, (_, g) => Math.min(5, shown - g * 5));
  let k = 0;
  return (
    <span className="tally inline-flex gap-1.5" aria-hidden="true">
      {groups.map((m, g) => (
        <svg key={g} width={m === 5 ? 26 : 5 * m + 2} height="18" viewBox={`0 0 ${m === 5 ? 26 : 5 * m + 2} 18`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          {Array.from({ length: Math.min(m, 4) }, (_, i) => {
            const d = delay + k++ * 55;
            return <line key={i} x1={3 + i * 5 + (i % 2) * 0.4} y1={2.5 + (i % 3) * 0.4} x2={3 + i * 5 - (i % 2) * 0.3} y2={16 - (i % 2) * 0.5} style={{ animationDelay: `${d}ms` }} />;
          })}
          {m === 5 && <line x1="0.8" y1="13.5" x2="21.5" y2="4" style={{ animationDelay: `${delay + k++ * 55}ms`, strokeDasharray: 24, strokeDashoffset: 24 }} />}
        </svg>
      ))}
    </span>
  );
}

// ───────── ⌘K: find a caller or jump to a page ─────────
const PAGES = [
  { href: "/dashboard", label: "Today" },
  { href: "/dashboard/calls", label: "Needs you" },
  { href: "/dashboard/history", label: "Call history" },
  { href: "/dashboard/appointments", label: "Appointments" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/settings", label: "Receptionist settings" },
];
export const openFinder = () => window.dispatchEvent(new Event("pulse:find"));

export function CommandBar({ timezone }: { timezone: string }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [calls, setCalls] = useState<CallRow[] | null>(null);
  const [active, setActive] = useState(0);
  const opener = useRef<HTMLElement | null>(null);

  const [atPath, setAtPath] = useState(path);
  const close = useCallback(() => { setOpen(false); setQ(""); setActive(0); opener.current?.focus?.(); }, []);
  const load = () => api<{ calls: CallRow[] }>("/api/calls").then((r) => setCalls(r.calls)).catch(() => setCalls([]));
  // Navigating anywhere closes the bar.
  if (atPath !== path) { setAtPath(path); if (open) { setOpen(false); setQ(""); setActive(0); } }

  useEffect(() => {
    const show = () => { opener.current = document.activeElement as HTMLElement; setOpen(true); load(); };
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); opener.current = document.activeElement as HTMLElement; setOpen(true); load(); }
    };
    window.addEventListener("pulse:find", show);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pulse:find", show); window.removeEventListener("keydown", key); };
  }, []);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pages = PAGES.filter((p) => !needle || p.label.toLowerCase().includes(needle)).map((p) => ({ kind: "page" as const, key: p.href, label: p.label, meta: "Page", go: p.href }));
    const people = needle
      ? (calls ?? []).filter((c) => [who(c), c.from_number, fmtPhone(c.from_number), c.reason].join(" ").toLowerCase().includes(needle)).slice(0, 7)
        .map((c) => ({ kind: "call" as const, key: c.id, label: who(c), sub: c.reason || c.summary || "", meta: relDay(c.started_at, timezone), go: `/dashboard/history?call=${c.id}` }))
      : (calls ?? []).slice(0, 4).map((c) => ({ kind: "call" as const, key: c.id, label: who(c), sub: c.reason || "", meta: relDay(c.started_at, timezone), go: `/dashboard/history?call=${c.id}` }));
    const search = needle ? [{ kind: "search" as const, key: "search", label: `Search every call for “${q.trim()}”`, meta: "Transcripts too", go: `/dashboard/history?q=${encodeURIComponent(q.trim())}` }] : [];
    return [...people, ...search, ...pages];
  }, [q, calls, timezone]);

  const go = (href: string) => { close(); router.push(href); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="cmdk-back" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
          <motion.div role="dialog" aria-modal="true" aria-label="Find a call or page" className="cmdk"
            initial={{ opacity: 0, y: -8, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.99 }} transition={{ type: "spring", stiffness: 600, damping: 42 }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); close(); }
              else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active].go); }
              else if (e.key === "Tab") e.preventDefault();
            }}>
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} placeholder="Find a caller, a number, or a page" aria-label="Find"
              role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={items[active] ? `cmdk-${items[active].key}` : undefined} />
            <ul id="cmdk-list" role="listbox" aria-label="Results">
              {items.length === 0 && <li className="group" role="presentation">{calls === null ? "Loading calls…" : "Nothing matches. Try a name, a number, or a word they said."}</li>}
              {items.map((it, i) => {
                const head = i === 0 || items[i - 1].kind !== it.kind;
                return (
                  <FragmentWithHead key={it.key} head={head ? (it.kind === "call" ? (q ? "Callers" : "Latest calls") : it.kind === "page" ? "Go to" : null) : null}>
                    <li id={`cmdk-${it.key}`} role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onClick={() => go(it.go)}>
                      <span className="min-w-0">
                        <span className={it.kind === "search" ? "text-[var(--pen)] font-semibold" : "font-semibold"}>{it.label}</span>
                        {"sub" in it && it.sub && <span className="block small truncate">{it.sub}</span>}
                      </span>
                      <span className="meta">{it.meta}</span>
                    </li>
                  </FragmentWithHead>
                );
              })}
            </ul>
            <div className="foot" aria-hidden="true"><span><kbd>↑</kbd> <kbd>↓</kbd> choose</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
function FragmentWithHead({ head, children }: { head: string | null; children: ReactNode }) {
  return <>{head && <li className="group" role="presentation">{head}</li>}{children}</>;
}

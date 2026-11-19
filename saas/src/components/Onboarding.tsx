"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { applyAnswer, BUSINESS_TYPES, nextQuestion, progress, questions, type Answer, type Question } from "@/lib/packs";
import { catalogNoun, DAYS, type CallerNeed, type CatalogItem, type Profile } from "@/lib/profile";
import { PageTurn, ScanPreview, StepFill } from "./motion";
import { motion } from "motion/react";
import { Orb } from "./Orb";
import { api, BackIcon, Logo, MicIcon, PlayIcon, SlideButton, XIcon } from "./ui";
import { Connections, type ConnInfo } from "./Connections";

type Biz = { profile: Profile; step: string; agentId: string | null; phoneNumber: string | null; voicePlatform?: string; browserTest?: boolean; status: string; publishedVersion: number | null; connections: ConnInfo };
const STEPS = ["find", "type", "interview", "review", "connect", "voice", "live"] as const;
type Step = (typeof STEPS)[number];
const SECTION: Record<Step, number> = { find: 1, type: 1, interview: 2, review: 2, connect: 3, voice: 4, live: 5 };
const SECTION_NAME = ["", "Your business", "What callers ask", "Your tools", "Voice", "Phone number"];

export function Onboarding({ initial, aiReady, accountEmail }: { initial: Biz; aiReady: boolean; accountEmail: string }) {
  const router = useRouter();
  const [biz, setBiz] = useState<Biz>(initial);
  const [step, setStep] = useState<Step>((STEPS as readonly string[]).includes(initial.step) ? (initial.step as Step) : "find");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const p = biz.profile;
  // Which way the page turns: forward through setup, or back.
  const prevIdx = useRef(STEPS.indexOf(step));
  const dir: 1 | -1 = STEPS.indexOf(step) >= prevIdx.current ? 1 : -1;
  useEffect(() => { prevIdx.current = STEPS.indexOf(step); }, [step]);

  async function go(next: Step, patch?: Partial<Profile>) {
    setBusy(true);
    setError("");
    try {
      const r = await api<Biz>("/api/business", { method: "PATCH", json: { profile: patch, step: next } });
      setBiz(r);
      setStep(next);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  const back = () => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);

  const shell = (title: string, intro: string, body: React.ReactNode) => (
    <main className="min-h-dvh flex flex-col">
      <StepBar section={SECTION[step]} onBack={step !== "find" ? back : undefined} />
      <PageTurn turnKey={step} dir={dir} className="w-full max-w-[600px] mx-auto flex-1 flex flex-col">
        <div key={step} className="rise flex-1 flex flex-col px-5 pt-8 pb-10">
          <h1 className="h1">{title}</h1>
          <p className="sub mt-1.5 mb-6">{intro}</p>
          {body}
          {error && <p role="alert" className="mt-3 text-sm text-[var(--ribbon)]">{error}</p>}
        </div>
      </PageTurn>
    </main>
  );

  if (step === "find") return shell("What's your business called?", "We'll start with the basics. You can change anything later.", <FindStep p={p} aiReady={aiReady} setBiz={setBiz} onNext={() => go("type")} setError={setError} />);
  if (step === "type")
    return shell("What kind of business is it?", "This decides which questions I ask you next.", <TypeStep p={p} busy={busy} onNext={(type, callerNeeds) => go("interview", { type, callerNeeds })} />);
  if (step === "interview") return <Interview biz={biz} setBiz={setBiz} aiReady={aiReady} dir={dir} onBack={back} onDone={() => go("review")} />;
  if (step === "review") return shell(`Check what ${p.receptionist.name} knows`, "This is what your receptionist will tell callers. Fix anything that's off.", <ReviewStep p={p} busy={busy} onNext={(patch) => go("connect", patch)} />);
  if (step === "connect") return shell("Connect your tools", "Optional. Your receptionist works without them.", <ConnectStep biz={biz} accountEmail={accountEmail} busy={busy} onNext={() => go("voice")} />);
  if (step === "voice") return shell("Pick a voice", "Play a few, choose one, then talk to your receptionist before any customer does.", <VoiceStep biz={biz} setBiz={setBiz} onNext={() => go("live")} setError={setError} />);
  return shell("Send calls to your receptionist", "Last step. You can also skip this and get a number later.", <LiveStep biz={biz} setBiz={setBiz} onDone={() => router.replace("/dashboard?welcome=1")} setError={setError} />);
}

function StepBar({ section, onBack, children }: { section: number; onBack?: () => void; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-[var(--paper)]/95 backdrop-blur border-b border-[var(--rule)]">
      <div className="max-w-[600px] mx-auto px-5 h-16 flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} aria-label="Back" className="btn btn-soft w-10 px-0 shrink-0"><BackIcon /></button>
        ) : <Logo size={20} />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">Step {section} of 5<span className="font-normal text-[var(--muted)]">, {SECTION_NAME[section].toLowerCase()}</span></p>
          <StepFill section={section} />
        </div>
        {children}
      </div>
    </header>
  );
}

/* ---------- Step 1: find ---------- */
function FindStep({ p, aiReady, setBiz, onNext, setError }: { p: Profile; aiReady: boolean; setBiz: (b: Biz) => void; onNext: () => void; setError: (s: string) => void }) {
  const [name, setName] = useState(p.name);
  const [url, setUrl] = useState(p.website ?? "");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<string[] | null>(null);
  async function submit() {
    if (!name.trim()) return setError("Add your business name.");
    setBusy(true);
    setError("");
    try {
      const r = await api<Biz & { found: string[] }>("/api/onboarding/website", { method: "POST", json: { name, url: aiReady ? url : "" } });
      setBiz(r);
      if (url && aiReady) setFound(r.found);
      else onNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that website");
    } finally {
      setBusy(false);
    }
  }
  if (found)
    return (
      <div className="flex flex-col flex-1">
        {/* The finished page is laid down, then each find is written onto it. */}
        <motion.div className="sheet p-5" initial={{ rotateX: -16, y: 14, opacity: 0 }} animate={{ rotateX: 0, y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} style={{ transformPerspective: 1200, transformOrigin: "top center" }}>
          <p className="h2">{name}</p>
          <p className="small mt-1">I read your website and found:</p>
          <ul className="mt-3 ruled text-[15px]">
            {(found.length ? found : ["Not much yet. We'll fill it in together."]).map((f, i) => (
              <motion.li key={f} className="py-2 flex items-center gap-2.5" initial={{ clipPath: "inset(0 100% 0 0)" }} animate={{ clipPath: "inset(0 0% 0 0)" }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.35 + i * 0.22 }}>
                {found.length > 0 && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                {f}
              </motion.li>
            ))}
          </ul>
        </motion.div>
        <div className="mt-auto pt-8"><SlideButton label="Continue" onClick={onNext} /></div>
      </div>
    );
  return (
    <form className="flex flex-col flex-1 gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label className="label">Business name<input className="field" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      {aiReady && (
        <label className="label">
          <span>Website <span className="hint">(optional; I&apos;ll read your hours, services and prices)</span></span>
          <input className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourbusiness.com" inputMode="url" />
        </label>
      )}
      {busy && url.trim() && (
        <div className="mt-4 flex flex-col gap-2">
          <ScanPreview label={`Reading ${url.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")}…`} />
          <p className="small" role="status" aria-live="polite">Reading every page of your site: menu, services, prices and hours. Big sites can take up to two minutes.</p>
        </div>
      )}
      <div className="mt-auto pt-8"><SlideButton type="submit" label={busy ? "Reading your site…" : "Continue"} disabled={busy} /></div>
    </form>
  );
}

/* ---------- Step 2: type ---------- */
function TypeStep({ p, busy, onNext }: { p: Profile; busy: boolean; onNext: (t: Profile["type"], needs: CallerNeed[]) => void }) {
  const [type, setType] = useState(p.type);
  const def = BUSINESS_TYPES.find((t) => t.id === type)?.needs ?? ["messages"];
  const [needs, setNeeds] = useState<CallerNeed[]>(p.callerNeeds.length > 1 ? p.callerNeeds : def);
  const NEEDS: { id: CallerNeed; label: string }[] = [
    { id: "booking", label: "Book appointments" }, { id: "reservations", label: "Reservations" }, { id: "orders", label: "Check on orders" },
    { id: "quotes", label: "Quotes" }, { id: "messages", label: "Questions & messages" },
  ];
  return (
    <div className="flex flex-col flex-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Business type">
        {BUSINESS_TYPES.map((t) => (
          <button key={t.id} aria-pressed={type === t.id} onClick={() => { setType(t.id); setNeeds(t.needs); }} className="option">
            {t.label}
          </button>
        ))}
      </div>
      <h2 className="h3 mt-8">What do callers usually need?</h2>
      <p className="small mt-0.5">Pick all that apply.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {NEEDS.map((n) => (
          <button key={n.id} className="chip" aria-pressed={needs.includes(n.id)} onClick={() => setNeeds(needs.includes(n.id) ? needs.filter((x) => x !== n.id) : [...needs, n.id])}>
            {n.label}
          </button>
        ))}
      </div>
      <div className="mt-auto pt-8"><SlideButton label="Continue" disabled={busy} onClick={() => onNext(type, needs)} /></div>
    </div>
  );
}

/* ---------- Step 3: interview (chat) ---------- */
type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };

function Interview({ biz, setBiz, aiReady, dir, onBack, onDone }: { biz: Biz; setBiz: (b: Biz) => void; aiReady: boolean; dir: 1 | -1; onBack: () => void; onDone: () => void }) {
  const p = biz.profile;
  const q = nextQuestion(p);
  const { done, total } = progress(p);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [talk, setTalk] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const history = useMemo(() => questions(p).filter((x) => x.id in p.answers), [p]);

  useEffect(() => {
    // Braces matter: newer Chrome returns a Promise from scrollIntoView, and React would treat it as a cleanup.
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [q?.id]);
  useEffect(() => {
    if (talk && q && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(q.prompt));
    }
  }, [talk, q]);

  async function answer(a: Answer) {
    if (!q) return;
    setBusy(true);
    setError("");
    try {
      setBiz(applyAnswerLocal(biz, q, a));
      setBiz(await api<Biz>("/api/onboarding/answer", { method: "POST", json: { questionId: q.id, answer: a } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col">
      <StepBar section={2} onBack={onBack}>
        <div role="group" aria-label="Answer by" className="flex border border-[var(--rule-strong)] rounded-[6px] p-0.5 bg-white shrink-0">
          <button aria-pressed={!talk} onClick={() => setTalk(false)} className={`h-8 px-3 rounded-[4px] text-sm ${!talk ? "bg-[var(--cloth)] text-[var(--cloth-ink)] font-semibold" : ""}`}>Type</button>
          <button aria-pressed={talk} onClick={() => setTalk(true)} className={`h-8 px-3 rounded-[4px] text-sm ${talk ? "bg-[var(--cloth)] text-[var(--cloth-ink)] font-semibold" : ""}`}>Talk</button>
        </div>
      </StepBar>

      <PageTurn turnKey="interview" dir={dir} className="w-full max-w-[600px] mx-auto flex-1 flex flex-col">
      <div className="flex-1 px-5 pt-6 pb-10 flex flex-col">
        <h1 className="h2">Setting up {p.name || "your business"}</h1>
        <p className="small mt-0.5">{q ? `Question ${Math.min(done + 1, total)} of about ${total}. Skip anything you're unsure of.` : "All questions answered."}</p>

        {history.length > 0 && (
          <ol className="mt-5 ruled border-y border-[var(--rule)]">
            {history.map((h, i) => (
              <li key={h.id} className="py-3">
                <p className="text-[15px]">{h.prompt}</p>
                <p className={`mt-1 text-[15px] font-medium text-[var(--pen)] ${i === history.length - 1 ? "ink" : ""}`}>{formatAnswer(h, p.answers[h.id], p)}</p>
                {h.id === "catalog" && p.catalog.length > 0 && <CatalogPreview items={p.catalog} noun={catalogNoun(p.type)} />}
              </li>
            ))}
          </ol>
        )}

        {q ? (
          <section key={q.id} className="rise sheet p-5 mt-5" aria-live="polite">
            <p className="text-[17px] font-semibold leading-snug">{q.prompt}</p>
            {q.help && <p className="small mt-1">{q.help}</p>}
            <div className="mt-4">
              <QuestionInput key={q.id} q={q} p={p} busy={busy} talk={talk} aiReady={aiReady} onAnswer={answer} setBiz={setBiz} setError={setError} />
            </div>
          </section>
        ) : (
          <section className="rise sheet p-5 mt-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <p className="text-[15px]">That&apos;s everything I need. Next, check what I&apos;ve got and fix anything that&apos;s off.</p>
            <SlideButton label="Review answers" onClick={onDone} />
          </section>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-[var(--ribbon)]">{error}</p>}
        <div ref={end} />
      </div>
      </PageTurn>
    </main>
  );
}

function applyAnswerLocal(b: Biz, q: Question, a: Answer): Biz {
  return { ...b, profile: applyAnswer(b.profile, q, a) };
}

function formatAnswer(q: Question, a: Answer | undefined, p: Profile): string {
  if (q.id === "catalog") return a === "skipped" ? "Skip for now" : `Here's my ${catalogNoun(p.type)} (${p.catalog.length} items)`;
  if (Array.isArray(a)) return a.length ? a.join(", ") : "None";
  if (typeof a === "boolean") return a ? "Yes" : "No";
  return a || "Skip";
}

function CatalogPreview({ items, noun }: { items: CatalogItem[]; noun: string }) {
  return (
    <div className="mt-3 rounded-[6px] border border-[var(--rule)] bg-white p-3">
      <p className="text-sm font-semibold">{items.length} items from your {noun}</p>
      <ul className="mt-1 max-h-52 overflow-auto text-sm ruled">
        {items.map((i) => (
          <li key={i.id} className="py-1.5 flex justify-between gap-3">
            <span>{i.name}</span>
            <span className="text-[var(--muted)] shrink-0">{[i.price, i.durationMin ? `${i.durationMin} min` : ""].filter(Boolean).join(", ")}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 small">You can edit these on the review screen.</p>
    </div>
  );
}

function QuestionInput({ q, p, busy, talk, aiReady, onAnswer, setBiz, setError }: {
  q: Question; p: Profile; busy: boolean; talk: boolean; aiReady: boolean; onAnswer: (a: Answer) => void; setBiz: (b: Biz) => void; setError: (s: string) => void;
}) {
  const [text, setText] = useState(q.suggested ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [rows, setRows] = useState<string[]>(p.staff.map((s) => (s.role ? `${s.name}, ${s.role}` : s.name)).concat(""));
  const [listening, setListening] = useState(false);

  function dictate() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) return setError("Voice typing isn't supported in this browser. Try Chrome, or type your answer.");
    const r = new Rec();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e) => setText((t) => `${t ? `${t} ` : ""}${e.results[0][0].transcript}`);
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  }
  const mic = (talk || q.kind === "text") && (
    <button type="button" onClick={dictate} aria-label={listening ? "Listening" : "Answer by voice"} aria-pressed={listening}
      className={`btn ${listening ? "" : "btn-soft"} w-11 px-0 shrink-0 ${listening ? "animate-pulse" : ""}`}>
      <MicIcon size={18} />
    </button>
  );

  if (q.kind === "upload") return <CatalogUpload p={p} aiReady={aiReady} setBiz={setBiz} setError={setError} onSkip={() => onAnswer("skipped")} />;
  if (q.kind === "choice" || q.kind === "yesno") {
    const opts = q.kind === "yesno" ? ["Yes", "No"] : q.options ?? [];
    return (
      <div className="flex flex-col gap-2 self-stretch">
        {opts.map((o) => (
          <button key={o} disabled={busy} onClick={() => onAnswer(q.kind === "yesno" ? (o === "Yes" ? "yes" : "no") : o)}
            className="option">
            {o}
          </button>
        ))}
      </div>
    );
  }
  if (q.kind === "multi")
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(q.options ?? []).map((o) => (
            <button key={o} className="chip" aria-pressed={picked.includes(o)} onClick={() => setPicked(picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o])}>{o}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn" disabled={busy} onClick={() => onAnswer(picked)}>{picked.length ? `Save ${picked.length} selected` : "None of these"}</button>
        </div>
      </div>
    );
  if (q.kind === "staff")
    return (
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <input key={i} className="field" placeholder="Name, role (e.g. Michael, senior stylist)" value={r}
            onChange={(e) => { const n = [...rows]; n[i] = e.target.value; if (i === rows.length - 1 && e.target.value) n.push(""); setRows(n); }} />
        ))}
        <div className="flex gap-2 mt-1">
          <button className="btn" disabled={busy} onClick={() => onAnswer(rows.filter((x) => x.trim()))}>Save team</button>
          {q.optional && <button className="btn btn-soft" onClick={() => onAnswer([])}>Skip</button>}
        </div>
      </div>
    );
  const type = q.kind === "email" ? "email" : q.kind === "phone" ? "tel" : "text";
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim() || q.optional) onAnswer(text.trim()); }}>
      <div className="flex gap-2 items-end">
        {q.kind === "text" ? (
          <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Your answer" />
        ) : (
          <input className="field" type={type} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your answer" required={!q.optional}
            placeholder={q.kind === "phone" ? "+1 555 123 4567" : q.kind === "email" ? "you@business.com" : ""} />
        )}
        {mic}
      </div>
      <div className="flex gap-2">
        <button className="btn" disabled={busy}>Save answer</button>
        {q.optional && <button type="button" className="btn btn-soft" onClick={() => onAnswer("")}>Skip</button>}
      </div>
    </form>
  );
}

function CatalogUpload({ p, aiReady, setBiz, setError, onSkip }: { p: Profile; aiReady: boolean; setBiz: (b: Biz) => void; setError: (s: string) => void; onSkip: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(!aiReady);
  const [preview, setPreview] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState("");
  // Several files (a menu over a few photos) are read one after another; each adds to the list.
  async function send(files?: File[]) {
    const list = files?.length ? files : [undefined];
    setPreview(list[0] && list[0].type.startsWith("image/") && !/heic|heif/i.test(list[0].type) ? URL.createObjectURL(list[0]) : undefined);
    setBusy(true);
    setError("");
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        setStep(list.length > 1 ? ` ${i + 1} of ${list.length}` : "");
        if (file && file.type.startsWith("image/") && !/heic|heif/i.test(file.type)) setPreview(URL.createObjectURL(file));
        const fd = new FormData();
        if (file) fd.append("file", file);
        if (i === 0) fd.append("text", text);
        const r = await fetch("/api/onboarding/catalog", { method: "POST", body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(list.length > 1 ? `${file?.name ?? "That file"}: ${d.error}` : d.error);
        setBiz(d);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that");
    } finally {
      setBusy(false);
      setStep("");
    }
  }
  async function saveManual() {
    // One item per line: "Name, price, minutes" (price and minutes optional)
    const items: CatalogItem[] = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, price, mins] = l.split(/\s*[,|]\s*/);
      return { id: crypto.randomUUID().slice(0, 8), name, price: price || undefined, durationMin: mins ? parseInt(mins) || null : null };
    });
    if (!items.length) return setError("Add at least one line.");
    setBusy(true);
    try {
      await api("/api/business", { method: "PATCH", json: { profile: { catalog: [...p.catalog, ...items] } } });
      setBiz(await api<Biz>("/api/onboarding/answer", { method: "POST", json: { questionId: "catalog", answer: "typed" } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  if (manual)
    return (
      <div className="flex flex-col gap-2">
        <textarea className="field" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label={`Your ${catalogNoun(p.type)}`}
          placeholder={p.type === "restaurant" ? "Margherita pizza, $16\nCaesar salad, $12" : "Women's haircut, $65, 60\nBalayage, $220, 210"} />
        <p className="small">One per line: name, price{p.type === "restaurant" ? "" : ", minutes"}.</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <button className="btn" disabled={busy} onClick={saveManual}>{busy ? "Saving…" : "Save list"}</button>
          {aiReady && <button className="btn-quiet" onClick={() => setManual(false)}>Upload a file instead</button>}
          <button className="btn-quiet muted" onClick={onSkip}>Skip for now</button>
        </div>
      </div>
    );
  if (busy) return <ScanPreview src={preview} label={`Reading your ${catalogNoun(p.type)}${step}…`} />;
  return (
    <div className="flex flex-col gap-2">
      <input ref={fileRef} type="file" multiple accept="image/*,.heic,.heif,application/pdf,.txt,.csv,.md,text/plain,text/csv" hidden onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) send(f); }} />
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>Upload photos or a PDF</button>
        <button className="btn btn-soft" disabled={busy} onClick={() => setManual(true)}>Type it instead</button>
      </div>
      <p className="small">Photos of your menu or price list, a PDF, or a text or CSV file. Several pages at once is fine.</p>
      <textarea className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Or paste it here" aria-label="Paste your list" />
      <div className="flex flex-wrap items-center gap-2">
        {text.trim() && <button className="btn" disabled={busy} onClick={() => send()}>Read what I pasted</button>}
        <button className="btn-quiet muted" onClick={onSkip}>Skip for now</button>
      </div>
    </div>
  );
}

/* ---------- Step 4: review ---------- */
function ReviewStep({ p, busy, onNext }: { p: Profile; busy: boolean; onNext: (patch: Partial<Profile>) => void }) {
  const [d, setD] = useState<Profile>(p);
  const [extra, setExtra] = useState("");
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setD({ ...d, [k]: v });
  const setItem = (id: string, patch: Partial<CatalogItem>) => set("catalog", d.catalog.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <div className="flex flex-col gap-5">
      <section className="sheet p-5 flex flex-col gap-3">
        <h2 className="h3">Basics</h2>
        <input className="field" value={d.name} onChange={(e) => set("name", e.target.value)} aria-label="Business name" />
        <input className="field" value={d.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Address" aria-label="Address" />
        <input className="field" value={d.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="Business phone" aria-label="Business phone" />
        <label className="label">Time zone
          <select className="field" value={d.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {["America/St_Johns", "America/Halifax", "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "Europe/London"].map((z) => <option key={z}>{z}</option>)}
          </select>
        </label>
      </section>
      <section className="sheet p-5">
        <h2 className="h3">Opening hours</h2>
        <div className="mt-2 ruled">
          {DAYS.map((day) => {
            const h = d.hours[day.id];
            return (
              <div key={day.id} className="flex items-center gap-2 text-sm py-2">
                <label className="w-28 flex items-center gap-2">
                  <input type="checkbox" checked={!!h} onChange={(e) => set("hours", { ...d.hours, [day.id]: e.target.checked ? { open: "09:00", close: "17:00" } : null })} />
                  {day.label}
                </label>
                {h ? (
                  <>
                    <input type="time" className="field !min-h-[34px] !w-auto px-2" value={h.open} onChange={(e) => set("hours", { ...d.hours, [day.id]: { ...h, open: e.target.value } })} aria-label={`${day.label} opens`} />
                    <span>to</span>
                    <input type="time" className="field !min-h-[34px] !w-auto px-2" value={h.close} onChange={(e) => set("hours", { ...d.hours, [day.id]: { ...h, close: e.target.value } })} aria-label={`${day.label} closes`} />
                  </>
                ) : <span className="text-[var(--muted)]">Closed</span>}
              </div>
            );
          })}
        </div>
      </section>
      <section className="sheet p-5">
        <h2 className="h3"><span className="capitalize">{catalogNoun(d.type)}</span> ({d.catalog.length})</h2>
        <div className="mt-2 flex flex-col gap-2 max-h-[420px] overflow-auto">
          {d.catalog.map((i) => (
            <div key={i.id} className="grid grid-cols-[1fr_84px_64px_34px] gap-1.5 items-center text-sm">
              <input className="field !min-h-[34px] px-2" value={i.name} onChange={(e) => setItem(i.id, { name: e.target.value })} aria-label="Name" />
              <input className="field !min-h-[34px] px-2" value={i.price ?? ""} placeholder="Price" onChange={(e) => setItem(i.id, { price: e.target.value })} aria-label="Price" />
              <input className="field !min-h-[34px] px-2" value={i.durationMin ?? ""} placeholder="Min" inputMode="numeric" onChange={(e) => setItem(i.id, { durationMin: parseInt(e.target.value) || null })} aria-label="Minutes" />
              <button aria-label={`Remove ${i.name}`} onClick={() => set("catalog", d.catalog.filter((x) => x.id !== i.id))} className="btn btn-soft !min-h-[34px] w-[34px] px-0 text-[var(--muted)]"><XIcon /></button>
            </div>
          ))}
          <button className="btn-quiet self-start" onClick={() => set("catalog", [...d.catalog, { id: crypto.randomUUID().slice(0, 8), name: "" }])}>Add an item</button>
        </div>
      </section>
      <section className="sheet p-5">
        <label className="h3" htmlFor="extra">Anything else {d.receptionist.name} should know?</label>
        <p className="small mt-0.5">What you&apos;d tell a new receptionist on day one.</p>
        {d.extra.length > 0 && <ul className="mt-2 text-sm list-disc pl-5 text-[var(--muted)]">{d.extra.map((e, k) => <li key={k}>{e}</li>)}</ul>}
        <textarea id="extra" className="field mt-3" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Parking is free after 5. Never promise same-day appointments." />
      </section>
      <SlideButton label="Looks right, continue" disabled={busy} onClick={() => onNext({ ...d, extra: extra.trim() ? [...d.extra, extra.trim()] : d.extra })} />
    </div>
  );
}

/* ---------- Step 5: connect ---------- */
function ConnectStep({ biz, accountEmail, busy, onNext }: { biz: Biz; accountEmail: string; busy: boolean; onNext: () => void }) {
  const soon = (name: string, what: string) => (
    <div key={name} className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1"><p className="font-semibold">{name}</p><p className="small">{what}</p></div>
      <span className="tag tag-Spam">Coming soon</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      {biz.connections.google?.status !== "ok" && biz.connections.microsoft?.status !== "ok" && (
        <div className="rounded-[8px] bg-[var(--ok-bg)] p-4 text-[15px]">
          <p className="font-semibold text-[var(--ok)]">Bookings already work, as requests</p>
          <p className="mt-1">Your receptionist takes the caller&apos;s details and preferred times, and you confirm. Connect Google or Outlook Calendar and it books real times instead.</p>
        </div>
      )}
      <Connections initial={biz.connections} returnTo="/onboarding" agentName={biz.profile.receptionist.name || "Maya"} notifyEmail={biz.profile.notifyEmail ?? ""} notifyWhatsApp={biz.profile.notifyWhatsApp ?? ""} accountEmail={accountEmail} />
      <section className="sheet">
        <h2 className="h3 px-5 pt-4 pb-1">More calendars</h2>
        <div className="ruled">{[soon("Cal.com", "Book real times"), soon("Calendly", "Book real times")]}</div>
      </section>
      <section className="sheet">
        <h2 className="h3 px-5 pt-4 pb-1">Orders and support</h2>
        <div className="ruled">{[soon("Shopify", "Answer \"where's my order?\""), soon("Zendesk", "Open support tickets")]}</div>
      </section>
      <SlideButton label="Continue" disabled={busy} onClick={onNext} />
    </div>
  );
}

/* ---------- Step 6: voice + test ---------- */
type Voice = { id: string; name: string; gender: string; accent: string; age: string; provider: string; preview: string };
function VoiceStep({ biz, setBiz, onNext, setError }: { biz: Biz; setBiz: (b: Biz) => void; onNext: () => void; setError: (s: string) => void }) {
  const p = biz.profile;
  const [voices, setVoices] = useState<Voice[]>([]);
  const [gender, setGender] = useState("all");
  const [accent, setAccent] = useState("all");
  const [name, setName] = useState(p.receptionist.name);
  const [voiceId, setVoiceId] = useState(p.receptionist.voiceId ?? "");
  const [building, setBuilding] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api<{ voices: Voice[] }>("/api/voices").then((r) => setVoices(r.voices)).catch((e) => setError(e.message));
  }, [setError]);
  const accents = [...new Set(voices.map((v) => v.accent).filter(Boolean))].sort();
  const shown = voices.filter((v) => (gender === "all" || v.gender === gender) && (accent === "all" || v.accent === accent)).slice(0, 24);

  function play(v: Voice) {
    audio.current?.pause();
    audio.current = new Audio(v.preview);
    audio.current.play().catch(() => {});
  }
  async function build() {
    const v = voices.find((x) => x.id === voiceId);
    if (!v) return setError("Pick a voice first.");
    setBuilding(true);
    setError("");
    try {
      await api("/api/business", { method: "PATCH", json: { profile: { receptionist: { name: name.trim() || "Maya", voiceId: v.id, voiceLabel: `${v.name} (${[v.gender, v.accent].filter(Boolean).join(", ")})` } } } });
      setBiz(await api<Biz>("/api/agent", { method: "POST" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build your receptionist");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="label">Receptionist&apos;s name
        <input className="field max-w-[280px]" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {["all", "female", "male"].map((g) => <button key={g} className="chip capitalize" aria-pressed={gender === g} onClick={() => setGender(g)}>{g === "all" ? "Any voice" : g}</button>)}
        <select className="chip pr-2" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="Accent">
          <option value="all">Any accent</option>
          {accents.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <div role="radiogroup" aria-label="Voices" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {shown.map((v) => (
          <div key={v.id} role="radio" aria-checked={voiceId === v.id} tabIndex={0} onClick={() => setVoiceId(v.id)} onKeyDown={(e) => e.key === "Enter" && setVoiceId(v.id)}
            className="option !items-start !flex-col !gap-1 !p-3">
            <div className="flex items-center gap-2">
              <button aria-label={`Play ${v.name}`} onClick={(e) => { e.stopPropagation(); play(v); }} className="btn w-8 !min-h-8 px-0 rounded-full shrink-0">
                <PlayIcon />
              </button>
              <span className="font-semibold text-sm truncate">{v.name}</span>
            </div>
            <p className="text-xs text-[var(--muted)] capitalize">{[v.gender, v.accent, v.age].filter(Boolean).join(", ")}</p>
          </div>
        ))}
      </div>
      <button className="btn btn-lg self-start" disabled={building || !voiceId} onClick={build}>
        {building ? "Building your receptionist…" : biz.agentId ? "Save voice & update" : `Build ${name || "Maya"}`}
      </button>
      {biz.agentId && biz.browserTest !== false && (
        <div className="sheet p-6 flex flex-col items-center gap-2">
          <p className="h2">Try {name} now</p>
          <p className="small text-center">Ask about prices, book something, or ask for a person.</p>
          <Orb name={name} />
        </div>
      )}
      <SlideButton label="Continue" disabled={!biz.agentId} onClick={onNext} />
    </div>
  );
}

/* ---------- Step 7: go live ---------- */
function LiveStep({ biz, setBiz, onDone, setError }: { biz: Biz; setBiz: (b: Biz) => void; onDone: () => void; setError: (s: string) => void }) {
  const free = biz.voicePlatform === "vapi"; // Vapi: a free US number, nothing to buy
  const [country, setCountry] = useState<"US" | "CA">("US");
  const [area, setArea] = useState("");
  const [confirm, setConfirm] = useState(free);
  const [busy, setBusy] = useState(false);
  async function live() {
    setBusy(true);
    setError("");
    try {
      setBiz(await api<Biz>("/api/golive", { method: "POST", json: { country, areaCode: area, confirmPurchase: confirm } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't go live");
    } finally {
      setBusy(false);
    }
  }
  if (biz.phoneNumber && biz.status === "live")
    return (
      <div className="flex flex-col gap-4">
        <div className="sheet p-5">
          <p className="small">Your receptionist&apos;s number</p>
          <p className="cond text-[32px] font-bold mt-0.5 ink">{biz.phoneNumber}</p>
        </div>
        <div className="sheet p-5 text-[15px] leading-relaxed">
          <p className="font-semibold">Keep your existing number</p>
          <p className="mt-1">Forward your business line to the number above. On most mobiles, dial <b>*72</b> then the number (or <b>*004*</b> number <b>#</b> for "when busy or unanswered"). Desk phones and VoIP: use your provider's forwarding setting.</p>
        </div>
        <SlideButton label="Open my day page" onClick={onDone} />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="sheet p-5 flex flex-col gap-3">
        <h2 className="h3">Get a local number for {biz.profile.receptionist.name}</h2>
        {free ? (
          <p className="small -mt-1">A free US number. From Canada it may count as long distance on some plans. It starts answering in about two minutes.</p>
        ) : (
          <div className="flex gap-2">
            {(["US", "CA"] as const).map((c) => <button key={c} className="chip" aria-pressed={country === c} onClick={() => setCountry(c)}>{c === "US" ? "United States" : "Canada"}</button>)}
          </div>
        )}
        {country === "US" && <input className="field" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Area code you'd like (optional)" inputMode="numeric" />}
        {!free && (
          <label className="flex gap-2 items-start text-sm">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
            I understand this adds a phone number (about $2/month) to my plan.
          </label>
        )}
        <p className="small">You keep your current number and forward it to this one.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
      <button className="btn btn-lg" disabled={busy || !confirm} onClick={live}>{busy ? "Turning on…" : `Turn ${biz.profile.receptionist.name} on`}</button>
      <button className="btn btn-soft btn-lg" disabled={busy} onClick={async () => {
        setBusy(true);
        setError("");
        try {
          await api("/api/golive", { method: "POST", json: { testOnly: true } });
          onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Couldn't finish setup");
          setBusy(false);
        }
      }}>Skip for now, I&apos;m just testing</button>
      </div>
      <p className="small">Skipping gets no number yet. You can get one any time from the Receptionist page.</p>
    </div>
  );
}

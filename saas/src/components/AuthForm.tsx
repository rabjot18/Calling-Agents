"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Logo } from "./ui";

// Sample entries for the little day page on the cloth (labelled as a sample).
const SAMPLE = [
  { t: "9:12", who: "Sara Mendes", why: "Cut and colour, Thursday 2:30", tag: "Booked", cls: "tag-Booked" },
  { t: "11:40", who: "Tom Lee", why: "Balayage price and parking", tag: "Info", cls: "tag-Info" },
  { t: "12:05", who: "Dana Ruiz", why: "Scalp reaction after colour", tag: "Urgent", cls: "tag-urgent", urgent: true },
];

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(signup ? "/api/auth/signup" : "/api/auth/login", { method: "POST", json: Object.fromEntries(f) });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh grid grid-rows-[auto_1fr] md:grid-rows-1 md:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] bg-[var(--paper)]">
      <aside className="relative cloth-tex bg-[var(--cloth)] text-[var(--cloth-ink)] px-5 sm:px-10 lg:px-14 py-5 md:py-10 flex md:flex-col gap-10 overflow-hidden">
        <Link href="/" aria-label="Pulse home" className="self-start"><Logo light /></Link>
        <div className="hidden md:flex flex-col flex-1 justify-center gap-12">
          <p className="cond font-extrabold text-[clamp(40px,4.6vw,64px)] leading-[0.95] tracking-[-0.02em] max-w-[14ch]">
            {signup ? "Your receptionist, set up by lunch." : "Your day page is waiting."}
          </p>
          <figure className="bg-white text-[var(--ink)] rounded-[6px] shadow-[0_30px_60px_-28px_rgba(0,0,0,.65),0_14px_24px_-16px_rgba(0,0,0,.4)] rotate-[-1.5deg] max-w-[440px] relative" aria-label="A sample day page">
            <span aria-hidden="true" className="absolute right-8 -top-1.5 w-4 h-[72px] bg-[var(--ribbon)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_86%,0_100%)] shadow-[0_6px_10px_rgba(0,0,0,.25)]" />
            <p className="cond font-extrabold text-[22px] px-5 pt-5 pb-3">Tuesday 17 November</p>
            <ol>
              {SAMPLE.map((r) => (
                <li key={r.t} className="relative grid grid-cols-[48px_minmax(0,1fr)_auto] gap-x-3 px-5 py-3 border-t border-[var(--rule)]">
                  {r.urgent && <span aria-hidden="true" className="absolute left-1.5 top-3 w-2.5 h-6 bg-[var(--ribbon)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)]" />}
                  <span className="cond font-bold text-[14px] text-[var(--muted)] pt-0.5">{r.t}</span>
                  <span className="min-w-0"><b className="block text-[15px]">{r.who}</b><span className="block text-[13px] text-[var(--muted)] truncate">{r.why}</span></span>
                  <span className={`tag ${r.cls} self-start`}>{r.tag}</span>
                </li>
              ))}
            </ol>
          </figure>
        </div>
        <p className="hidden md:block text-[13px] text-[var(--cloth-muted)]">Sample day for a made-up salon. Yours fills in as your receptionist answers.</p>
      </aside>

      <section className="px-5 sm:px-10 py-10 md:py-14 flex flex-col">
        <Link href="/" className="hidden md:block self-end text-[14px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]">Back to home</Link>
        <div className="flex-1 flex items-center">
          <form onSubmit={submit} className="w-full max-w-[420px] mx-auto md:mx-0 md:ml-[8%] flex flex-col gap-5">
            <div className="mb-2">
              <h1 className="cond font-extrabold text-[clamp(36px,3.4vw,46px)] leading-[0.98] tracking-[-0.015em]">{signup ? "Create your account" : "Welcome back"}</h1>
              <p className="text-[16px] text-[var(--muted)] mt-3">{signup ? "Setup takes about 10 minutes. No card needed." : "Sign in to see today's calls."}</p>
            </div>
            {signup && (
              <label className="label">Your name<input name="name" className="field !h-12" autoComplete="name" required /></label>
            )}
            <label className="label">Email<input name="email" type="email" className="field !h-12" autoComplete="email" inputMode="email" required /></label>
            <div>
              <label className="label" htmlFor="pw">Password</label>
              <div className="relative">
                <input id="pw" name="password" type={show ? "text" : "password"} className="field !h-12 w-full pr-20" autoComplete={signup ? "new-password" : "current-password"} minLength={8} required aria-describedby={signup ? "pw-hint" : undefined} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 h-9 px-3 rounded-[6px] text-[13.5px] font-semibold text-[var(--pen)] hover:bg-[var(--pen-bg)]" aria-pressed={show} aria-label={show ? "Hide password" : "Show password"}>
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              {signup && <p id="pw-hint" className="hint mt-1.5">At least 8 characters.</p>}
            </div>
            {error && <p className="text-[14.5px] text-[var(--ribbon)] bg-[var(--ribbon-bg)] rounded-[8px] px-3.5 py-2.5" role="alert">{error}</p>}
            <button className="btn btn-lg mt-1 w-full !min-h-[52px] text-[16px]" disabled={busy}>{busy ? "One moment…" : signup ? "Create account" : "Sign in"}</button>
            <p className="text-[14.5px] text-[var(--muted)]">
              {signup ? "Already have an account? " : "New to Pulse? "}
              <Link href={signup ? "/login" : "/signup"} className="font-semibold text-[var(--pen)] underline underline-offset-4">{signup ? "Sign in" : "Create an account"}</Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

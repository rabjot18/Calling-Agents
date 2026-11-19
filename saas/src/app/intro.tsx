import Link from "next/link";
import { Logo } from "@/components/ui";

// Example entries for the sample day page (illustrative, labelled as such on the page).
const SAMPLE = [
  { h: "9", ap: "am", rows: [{ t: "9:12", who: "Sara Mendes", why: "Booked a cut and colour, Thursday 2:30", tag: "Booked", cls: "tag-Booked" }] },
  { h: "10", ap: "am", rows: [] },
  { h: "11", ap: "am", rows: [{ t: "11:40", who: "Tom Lee", why: "Asked about balayage prices and parking", tag: "Info", cls: "tag-Info" }] },
  { h: "12", ap: "pm", rows: [{ t: "12:05", who: "Dana Ruiz", why: "Itchy scalp after Monday's colour. Call back", tag: "Urgent", cls: "tag-urgent", urgent: true }] },
  { h: "1", ap: "pm", rows: [] },
];

export function Intro() {
  return (
    <main className="min-h-dvh grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="bg-[var(--cloth)] text-[var(--cloth-ink)] px-5 sm:px-10 pt-6 pb-10 lg:pb-6 flex flex-col">
        <Logo light />
        <div className="flex-1 grid place-items-center pt-8 lg:pt-0">
          <figure className="w-full max-w-[460px] bg-white text-[var(--ink)] rounded-[6px] shadow-[0_18px_40px_rgba(0,0,0,.28)] rotate-[-1.2deg] relative">
            <span aria-hidden="true" className="absolute right-8 -top-1 w-3.5 h-16 bg-[var(--ribbon)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_86%,0_100%)]" />
            <div className="px-5 pt-4 pb-3 border-b border-[var(--rule-strong)] flex items-baseline justify-between gap-3">
              <p className="cond text-[22px] font-bold">Tuesday 17 November</p>
              <p className="text-xs text-[var(--faint)] pr-8">Example day</p>
            </div>
            <div className="day pb-3 pr-3">
              {SAMPLE.map((s) => (
                <div key={s.h} className="contents">
                  <div className="hour">{s.h}<small>{s.ap}</small></div>
                  <div className="slot">
                    {s.rows.map((r) => (
                      <div key={r.t} className="entry hover:bg-transparent">
                        {"urgent" in r && <span className="ribbon" aria-hidden="true" />}
                        <span className="t">{r.t}</span>
                        <span className="who truncate">{r.who}</span>
                        <span className={`tag ${r.cls}`}>{r.tag}</span>
                        <span className="why">{r.why}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </figure>
        </div>
      </section>

      <section className="px-5 sm:px-10 py-10 lg:py-6 flex flex-col justify-center">
        <div className="max-w-[460px]">
          <h1 className="cond text-[40px] sm:text-[48px] leading-[1.02] font-bold tracking-[-0.02em]">Every call, written into your day.</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">
            Pulse answers your business phone when you can&apos;t. It knows your prices and hours, takes bookings and messages,
            and puts each call on your day page, with anything urgent marked so you call back first.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/signup" className="btn btn-lg">Set up my receptionist</Link>
            <Link href="/login" className="btn btn-soft btn-lg">Sign in</Link>
          </div>
          <ol className="mt-10 ruled border-y border-[var(--rule)] text-[15px]">
            <li className="py-3 flex gap-3"><span className="cond font-bold text-[var(--faint)] w-5 shrink-0">1</span>Tell it about your business in a 10-minute chat, or upload your menu or price list.</li>
            <li className="py-3 flex gap-3"><span className="cond font-bold text-[var(--faint)] w-5 shrink-0">2</span>Pick a voice and talk to it in your browser before any customer does.</li>
            <li className="py-3 flex gap-3"><span className="cond font-bold text-[var(--faint)] w-5 shrink-0">3</span>Forward your line, then read every call, summary and transcript here.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}

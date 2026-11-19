"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "./ui";

// Google Calendar + email summaries. Used in onboarding ("Connect your tools") and Receptionist settings.
export type ConnInfo = {
  google: { account: string; status: string; connectedAt: number } | null;
  googleReady: boolean;
  microsoft: { account: string; status: string; connectedAt: number } | null;
  microsoftReady: boolean;
  liveBooking: boolean;
  emailReady: boolean;
  whatsappReady: boolean;
  whatsappSandbox: boolean;
};

const GOOGLE_MSG: Record<string, string> = {
  connected: "Google Calendar is connected.",
  cancelled: "Google connection cancelled. Nothing changed.",
  error: "Google didn't connect. Try again, and tick both calendar boxes on Google's screen.",
  unavailable: "Google Calendar isn't switched on for Pulse yet.",
};
const OUTLOOK_MSG: Record<string, string> = {
  connected: "Outlook Calendar is connected.",
  cancelled: "Outlook connection cancelled. Nothing changed.",
  error: "Outlook didn't connect. Try again and accept the calendar permission on Microsoft's screen.",
  unavailable: "Outlook Calendar isn't switched on for Pulse yet.",
};

export function Connections({ initial, returnTo, agentName, notifyEmail, notifyWhatsApp, accountEmail }: {
  initial: ConnInfo; returnTo: "/onboarding" | "/dashboard/settings"; agentName: string; notifyEmail: string; notifyWhatsApp: string; accountEmail: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const flag = sp.get("google");
  const oflag = sp.get("outlook");
  const [c, setC] = useState(initial);
  const [email, setEmail] = useState(notifyEmail);
  const [wa, setWa] = useState(notifyWhatsApp);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    flag && GOOGLE_MSG[flag] ? { ok: flag === "connected", text: GOOGLE_MSG[flag] } : oflag && OUTLOOK_MSG[oflag] ? { ok: oflag === "connected", text: OUTLOOK_MSG[oflag] } : null,
  );

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(label);
    setMsg(null);
    try { setMsg({ ok: true, text: await fn() }); router.refresh(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong" }); }
    finally { setBusy(""); }
  }

  return (
    <div className="flex flex-col gap-4">
      {msg && <p role="status" className={`rounded-[8px] p-3 text-[15px] ${msg.ok ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--urgent-bg,#fbe9e7)] text-[var(--ribbon)]"}`}>{msg.text}</p>}

      <section className="sheet">
        <h2 className="h3 px-5 pt-4 pb-1">Calendar</h2>
        <div className="ruled">
          {([
            { key: "google", name: "Google Calendar", mark: <GoogleMark />, conn: c.google, ready: c.googleReady, path: "google" },
            { key: "microsoft", name: "Outlook Calendar", mark: <OutlookMark />, conn: c.microsoft, ready: c.microsoftReady, path: "microsoft" },
          ] as const).map((row) => {
            const st = !row.conn ? "none" : row.conn.status === "ok" ? "ok" : "expired";
            const other = row.key === "google" ? c.microsoft : c.google;
            return (
              <div key={row.key} className="flex flex-wrap items-center gap-3 px-5 py-4">
                {row.mark}
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold">{row.name}</p>
                  <p className="small">
                    {st === "ok" && (c.liveBooking ? `Connected as ${row.conn!.account}. ${agentName} checks your free times and books callers in.` : `Connected as ${row.conn!.account}. Live booking switches on once Pulse is online; until then ${agentName} takes booking requests.`)}
                    {st === "expired" && `The connection to ${row.conn!.account} expired. Reconnect so ${agentName} can keep booking.`}
                    {st === "none" && (other?.status === "ok" ? `Connecting this replaces your ${row.key === "google" ? "Outlook" : "Google"} calendar.` : `${agentName} sees when you're free and books real times into your calendar.`)}
                  </p>
                </div>
                {!row.ready ? (
                  <span className="tag tag-Spam">Not switched on yet</span>
                ) : st === "ok" ? (
                  <button className="btn btn-soft" disabled={!!busy} onClick={() => run(row.key, async () => {
                    const r = await api<{ connections: ConnInfo }>(`/api/${row.path}/disconnect`, { method: "POST" });
                    setC(r.connections);
                    return `Disconnected. ${agentName} is back to taking booking requests.`;
                  })}>{busy === row.key ? "Disconnecting…" : "Disconnect"}</button>
                ) : (
                  <a className="btn" href={`/api/${row.path}/connect?return=${encodeURIComponent(returnTo)}`}>{st === "expired" ? "Reconnect" : "Connect"}</a>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="sheet">
        <h2 className="h3 px-5 pt-4 pb-1">Call summaries by email</h2>
        <form className="px-5 pb-4 pt-1 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); run("save", async () => {
          await api("/api/business", { method: "PATCH", json: { profile: { notifyEmail: email.trim() } } });
          return email.trim() ? `Summaries go to ${email.trim()}.` : `Summaries go to ${accountEmail}.`;
        }); }}>
          <p className="small">After every call you get who called, why, and what they need. Urgent calls are flagged in the subject line.</p>
          <label className="label mt-1" htmlFor="notify-email">Send them to</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id="notify-email" type="email" className="field flex-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={accountEmail} autoComplete="email" />
            <button className="btn btn-soft" disabled={!!busy}>{busy === "save" ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-soft" disabled={!!busy || !c.emailReady} onClick={() => run("test", async () => {
              const r = await api<{ to: string }>("/api/notify/test", { method: "POST" });
              return `Test sent to ${r.to}. Check your inbox (and spam, the first time).`;
            })}>{busy === "test" ? "Sending…" : "Send me a test"}</button>
          </div>
          {!c.emailReady && <p className="small">Email sending isn&apos;t switched on for Pulse yet. Your address is saved for when it is.</p>}
        </form>
      </section>

      <section className="sheet">
        <h2 className="h3 px-5 pt-4 pb-1">Call summaries on WhatsApp</h2>
        <form className="px-5 pb-4 pt-1 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); run("wa-save", async () => {
          await api("/api/business", { method: "PATCH", json: { profile: { notifyWhatsApp: wa.trim() } } });
          return wa.trim() ? "WhatsApp number saved." : "WhatsApp summaries are off.";
        }); }}>
          <p className="small">The same summary on your phone after each call, plus an instant heads-up when {agentName} transfers a caller to you.</p>
          <label className="label mt-1" htmlFor="notify-wa">Your WhatsApp number</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id="notify-wa" type="tel" inputMode="tel" className="field flex-1" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="+1 902 555 0123" autoComplete="tel" />
            <button className="btn btn-soft" disabled={!!busy}>{busy === "wa-save" ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-soft" disabled={!!busy || !c.whatsappReady} onClick={() => run("wa-test", async () => {
              const r = await api<{ to: string }>("/api/notify/whatsapp-test", { method: "POST" });
              return `Test sent to ${r.to} on WhatsApp.`;
            })}>{busy === "wa-test" ? "Sending…" : "Send me a test"}</button>
          </div>
          {!c.whatsappReady && <p className="small">WhatsApp isn&apos;t switched on for Pulse yet. Your number is saved for when it is.</p>}
          {c.whatsappReady && c.whatsappSandbox && (
            <p className="small">Pulse is using WhatsApp&apos;s test number for now: from this phone, send your <b>join</b> code to <b>+1 415 523 8886</b> first. It lasts 3 days, and messages only arrive within 24 hours of your last message to that number.</p>
          )}
        </form>
      </section>
    </div>
  );
}

const GoogleMark = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
    <rect x="3" y="4" width="26" height="25" rx="4" fill="#fff" stroke="#c7d1c7" strokeWidth="1.5" />
    <path d="M3 10h26" stroke="#c7d1c7" strokeWidth="1.5" />
    <path d="M10 2.5v4M22 2.5v4" stroke="#55655b" strokeWidth="1.75" strokeLinecap="round" />
    <text x="16" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#24477a" fontFamily="Archivo, sans-serif">31</text>
  </svg>
);

const OutlookMark = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
    <rect x="3" y="4" width="26" height="25" rx="4" fill="#fff" stroke="#c7d1c7" strokeWidth="1.5" />
    <path d="M3 10h26" stroke="#c7d1c7" strokeWidth="1.5" />
    <path d="M10 2.5v4M22 2.5v4" stroke="#55655b" strokeWidth="1.75" strokeLinecap="round" />
    <rect x="9" y="14" width="14" height="11" rx="2" fill="#24477a" />
    <text x="16" y="23" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="Archivo, sans-serif">O</text>
  </svg>
);

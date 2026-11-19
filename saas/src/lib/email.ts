import "server-only";
import { db, now } from "./db";
import type { Business } from "./auth";
import type { CallRow } from "./calls";
import { fmtDur, fmtPhone, fmtTime, tagOf, who } from "./callview";

// Post-call summary emails through Resend (docs/resend.md). One email per call, guarded by calls.notified_at.
const API = "https://api.resend.com/emails";
export const emailAvailable = () => Boolean(process.env.RESEND_API_KEY);
const FROM = () => process.env.RESEND_FROM || "Pulse <onboarding@resend.dev>";

export class EmailError extends Error {}

export async function sendEmail(m: { to: string; subject: string; html: string; text: string; idempotencyKey?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailError("Email isn't set up yet (RESEND_API_KEY is empty).");
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(m.idempotencyKey ? { "Idempotency-Key": m.idempotencyKey } : {}) },
    body: JSON.stringify({ from: FROM(), to: m.to, subject: m.subject, html: m.html, text: m.text }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    // 403 without a verified domain = Resend only delivers to the account owner's own address.
    throw new EmailError(res.status === 403 ? `Resend refused it: ${data.message ?? "verify a sending domain first"}` : `Resend error ${res.status}: ${data.message ?? "send failed"}`);
  }
  return data.id;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function ownerAddress(b: Business): string | null {
  if (b.profile.notifyEmail?.includes("@")) return b.profile.notifyEmail.trim();
  const u = db.prepare("SELECT email FROM users WHERE id = ?").get(b.user_id) as { email: string } | undefined;
  return u?.email ?? null;
}

export function summaryEmail(b: Business, c: CallRow) {
  const p = b.profile;
  const tz = p.timezone;
  const urgent = c.urgency === "urgent";
  const tag = tagOf(c).label;
  const name = who(c);
  const when = `${new Date(c.started_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz })}, ${fmtTime(c.started_at, tz)}`;
  const reason = c.reason || "No reason recorded";
  const subject = `${urgent ? "Urgent: " : ""}${name} called ${p.name || "you"}: ${reason}`.slice(0, 140);
  const link = `${process.env.APP_URL ?? ""}/dashboard/history`;
  const rows: [string, string][] = [
    ["When", when],
    ["Number", fmtPhone(c.from_number) || "Unknown"],
    ["Outcome", tag],
    ...(c.service || c.appointment_time ? ([["Requested", [c.service, c.appointment_time].filter(Boolean).join(", ")]] as [string, string][]) : []),
    ["Length", fmtDur(c.duration_ms) || "–"],
  ];
  const text = [
    `${urgent ? "URGENT. " : ""}${name} called ${p.name}.`,
    "",
    c.summary || reason,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    c.follow_up ? "\nThey want a call back." : "",
    "",
    `Open in Pulse: ${link}`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#fbfcfa;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16201b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbfcfa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e1e7e0;border-radius:10px;overflow:hidden">
<tr><td style="background:#1d3a30;color:#eaf1ec;padding:14px 20px;font-weight:700;font-size:15px">Pulse · ${esc(p.receptionist.name || "Maya")} took a call for ${esc(p.name)}</td></tr>
${urgent ? `<tr><td style="background:#b3261e;color:#fff;padding:8px 20px;font-weight:700;font-size:14px">Urgent: call them back first</td></tr>` : ""}
<tr><td style="padding:20px">
<div style="font-size:22px;font-weight:800;line-height:1.2">${esc(name)}</div>
<div style="font-size:14px;color:#55655b;margin-top:2px">${esc(reason)}</div>
<p style="font-size:15px;line-height:1.5;margin:16px 0">${esc(c.summary || reason)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;width:100%;border-top:1px solid #e1e7e0">
${rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#55655b;width:110px;border-bottom:1px solid #e1e7e0">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e1e7e0">${esc(v)}</td></tr>`).join("")}
</table>
${c.follow_up ? `<p style="font-size:14px;margin:14px 0 0;color:#b3261e;font-weight:600">They want a call back.</p>` : ""}
<p style="margin:20px 0 0">${c.from_number ? `<a href="tel:${esc(c.from_number)}" style="display:inline-block;background:#1d3a30;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;font-size:14px;margin-right:8px">Call back</a>` : ""}<a href="${esc(link)}" style="display:inline-block;border:1px solid #c7d1c7;color:#16201b;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:600;font-size:14px">Open in Pulse</a></p>
</td></tr></table>
<p style="font-size:12px;color:#55655b;margin-top:12px">You get this because you're the contact for ${esc(p.name)} on Pulse.</p>
</td></tr></table></body></html>`;
  return { subject, html, text };
}

// Sends the summary for one call if it's analysed and not emailed yet. Never throws (a failed email must not break call sync).
export async function emailCall(b: Business, callId: string): Promise<"sent" | "skipped" | "failed"> {
  if (!emailAvailable()) return "skipped";
  const c = db.prepare("SELECT * FROM calls WHERE id = ? AND business_id = ?").get(callId, b.id) as (CallRow & { notified_at: number | null }) | undefined;
  if (!c || c.notified_at !== null || !c.summary) return "skipped";
  if (c.outcome === "Spam") {
    db.prepare("UPDATE calls SET notified_at = ? WHERE id = ?").run(now(), c.id);
    return "skipped";
  }
  if (now() - c.started_at > 6 * 3600_000) return "skipped"; // don't email a backlog of old calls
  const to = ownerAddress(b);
  if (!to) return "skipped";
  // Claim first so two syncs running at once can't both send it.
  const claimed = db.prepare("UPDATE calls SET notified_at = ? WHERE id = ? AND notified_at IS NULL").run(now(), c.id).changes;
  if (!claimed) return "skipped";
  try {
    await sendEmail({ to, ...summaryEmail(b, c), idempotencyKey: `call-${c.id}` });
    return "sent";
  } catch (e) {
    db.prepare("UPDATE calls SET notified_at = NULL WHERE id = ?").run(c.id); // let the next sync retry
    console.error("call summary email failed:", e instanceof Error ? e.message : e);
    return "failed";
  }
}

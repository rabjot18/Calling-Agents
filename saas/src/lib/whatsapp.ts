import "server-only";
import { db, now } from "./db";
import type { Business } from "./auth";
import type { CallRow } from "./calls";
import { fmtPhone, fmtTime, who } from "./callview";

// WhatsApp alerts to the owner through Twilio (docs/twilio-whatsapp.md).
// Testing: Twilio's shared sandbox number (+1 415 523 8886). Free text only works within 24 h of the owner's last
// message to that number, and joining lapses after 3 days. Production: set TWILIO_WHATSAPP_FROM to your approved
// sender and TWILIO_WHATSAPP_CONTENT_SID to an approved "call summary" Utility template (variables 1–4 below).
const FROM = () => process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
export const whatsappAvailable = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
export const usingSandbox = () => FROM().endsWith("14155238886");

export class WhatsAppError extends Error {
  constructor(public code: number | null, message: string) {
    super(message);
  }
}

// Plain-English reasons for the Twilio errors owners actually hit.
const EXPLAIN: Record<number, string> = {
  63015: "This phone hasn't joined Pulse's WhatsApp test number yet. Send the \"join\" code from it first.",
  63016: "WhatsApp only allows free messages within 24 hours of your last message to Pulse's number. Send it any message, then try again.",
  21211: "That doesn't look like a valid phone number.",
  21608: "Twilio trial accounts can only message verified numbers.",
};

export async function sendWhatsApp(toE164: string, body: string, template?: Record<string, string>) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) throw new WhatsAppError(null, "WhatsApp isn't switched on yet.");
  const form = new URLSearchParams({ From: FROM(), To: `whatsapp:${toE164}` });
  const content = process.env.TWILIO_WHATSAPP_CONTENT_SID;
  if (content && template) {
    form.set("ContentSid", content);
    form.set("ContentVariables", JSON.stringify(template));
  } else form.set("Body", body.slice(0, 1500));
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${tok}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  const d = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; code?: number; message?: string };
  if (!res.ok) throw new WhatsAppError(d.code ?? null, EXPLAIN[d.code ?? 0] ?? `Twilio error ${d.code ?? res.status}: ${d.message ?? "send failed"}`);
  return d.sid;
}

// Twilio accepts the send, then delivery can still fail (e.g. outside the 24 h window). Look the message up once.
export async function deliveryProblem(messageSid: string): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID!, tok = process.env.TWILIO_AUTH_TOKEN!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${messageSid}.json`, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${tok}`).toString("base64")}` },
    signal: AbortSignal.timeout(10_000),
  });
  const d = (await res.json().catch(() => ({}))) as { status?: string; error_code?: number | null; error_message?: string | null };
  if (d.status === "failed" || d.status === "undelivered") return EXPLAIN[d.error_code ?? 0] ?? `WhatsApp couldn't deliver it (error ${d.error_code}).`;
  return null;
}

export function summaryText(b: Business, c: CallRow) {
  const p = b.profile;
  const urgent = c.urgency === "urgent";
  const lines = [
    `${urgent ? "🔴 URGENT · " : ""}${p.receptionist.name || "Maya"} took a call for ${p.name}`,
    `${who(c)}${c.from_number ? ` · ${fmtPhone(c.from_number)}` : ""} · ${fmtTime(c.started_at, p.timezone)}`,
    "",
    c.summary || c.reason || "No summary yet.",
    c.service || c.appointment_time ? `Requested: ${[c.service, c.appointment_time].filter(Boolean).join(", ")}` : "",
    c.follow_up ? "They want a call back." : "",
    "",
    `Open in Pulse: ${process.env.APP_URL ?? ""}/dashboard/history`,
  ];
  return {
    body: lines.filter((l, i, a) => l || (a[i - 1] ?? "") !== "").join("\n").trim(),
    template: { "1": p.name || "your business", "2": who(c), "3": fmtPhone(c.from_number) || "unknown number", "4": (c.summary || c.reason || "").slice(0, 600) },
  };
}

// One WhatsApp per call, after analysis. Same rules as email: recent calls only, spam skipped, never throws.
export async function whatsappCall(b: Business, callId: string): Promise<"sent" | "skipped" | "failed"> {
  const to = b.profile.notifyWhatsApp;
  if (!whatsappAvailable() || !to) return "skipped";
  const c = db.prepare("SELECT * FROM calls WHERE id = ? AND business_id = ?").get(callId, b.id) as (CallRow & { wa_notified_at: number | null }) | undefined;
  if (!c || c.wa_notified_at !== null || !c.summary || c.outcome === "Spam" || now() - c.started_at > 6 * 3600_000) return "skipped";
  if (!db.prepare("UPDATE calls SET wa_notified_at = ? WHERE id = ? AND wa_notified_at IS NULL").run(now(), c.id).changes) return "skipped";
  try {
    const m = summaryText(b, c);
    await sendWhatsApp(to, m.body, m.template);
    return "sent";
  } catch (e) {
    db.prepare("UPDATE calls SET wa_notified_at = NULL WHERE id = ?").run(c.id);
    console.error("call summary WhatsApp failed:", e instanceof Error ? e.message : e);
    return "failed";
  }
}

// The instant "transferring now" heads-up, sent when Retell starts a transfer (before any post-call summary exists).
export async function whatsappTransfer(b: Business, call: { call_id: string; from_number?: string }, gist: string | null) {
  const to = b.profile.notifyWhatsApp;
  if (!whatsappAvailable() || !to) return;
  const body = [
    `📞 Transferring a caller to you now · ${b.profile.name}`,
    call.from_number ? `From ${fmtPhone(call.from_number)}` : "",
    gist ? `\n${gist}` : "",
  ].filter(Boolean).join("\n");
  try {
    await sendWhatsApp(to, body, { "1": b.profile.name, "2": "Transferred caller", "3": fmtPhone(call.from_number ?? null) || "unknown number", "4": gist ?? "Transferring to you now." });
  } catch (e) {
    console.error("transfer WhatsApp failed:", e instanceof Error ? e.message : e);
  }
}

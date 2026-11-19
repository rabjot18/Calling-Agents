import { emailAvailable, ownerAddress, sendEmail, summaryEmail } from "@/lib/email";
import { fail, json, withBusiness } from "@/lib/http";
import type { CallRow } from "@/lib/calls";

// "Send me a test email": a sample summary so the owner sees exactly what arrives after a call.
export const POST = withBusiness(async (b) => {
  if (!emailAvailable()) return fail("Email isn't switched on yet.", 503);
  const to = ownerAddress(b);
  if (!to) return fail("Add an email address first.");
  const sample: CallRow = {
    id: "sample", started_at: Date.now(), duration_ms: 134000, call_type: "phone_call", from_number: "+19025550123", caller_name: "Sample Caller",
    reason: "Test of your call summaries", summary: `This is what ${b.profile.receptionist.name || "Maya"} sends after each call: who called, why, and what they need.`,
    outcome: "Message", urgency: "normal", after_hours: 0, follow_up: 1, done: 0, appointment_time: null, service: null, transcript_json: null, recording_url: null,
  };
  const m = summaryEmail(b, sample);
  await sendEmail({ to, subject: `Test: ${m.subject}`, html: m.html, text: m.text });
  return json({ ok: true, to });
});

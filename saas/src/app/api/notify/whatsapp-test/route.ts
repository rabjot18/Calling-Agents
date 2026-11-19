import { deliveryProblem, sendWhatsApp, summaryText, whatsappAvailable, WhatsAppError } from "@/lib/whatsapp";
import { fail, json, withBusiness } from "@/lib/http";
import type { CallRow } from "@/lib/calls";

// "Send me a test": a sample summary to the owner's WhatsApp, then one delivery check so sandbox problems show up in words.
export const POST = withBusiness(async (b) => {
  if (!whatsappAvailable()) return fail("WhatsApp isn't switched on yet.", 503);
  const to = b.profile.notifyWhatsApp;
  if (!to) return fail("Add your WhatsApp number first.");
  const sample: CallRow = {
    id: "sample", started_at: Date.now(), duration_ms: 134000, call_type: "phone_call", from_number: "+19025550123", caller_name: "Sample Caller",
    reason: "Test of your WhatsApp summaries", summary: `This is what ${b.profile.receptionist.name || "Maya"} sends after each call: who called, why, and what they need.`,
    outcome: "Message", urgency: "normal", after_hours: 0, follow_up: 1, done: 0, appointment_time: null, service: null, transcript_json: null, recording_url: null,
  };
  const m = summaryText(b, sample);
  try {
    const sid = await sendWhatsApp(to, `Test from Pulse\n\n${m.body}`, m.template);
    await new Promise((r) => setTimeout(r, 2500));
    const problem = sid ? await deliveryProblem(sid) : null;
    if (problem) return fail(problem, 502);
    return json({ ok: true, to });
  } catch (e) {
    return fail(e instanceof WhatsAppError ? e.message : "Couldn't send the WhatsApp message.", 502);
  }
});

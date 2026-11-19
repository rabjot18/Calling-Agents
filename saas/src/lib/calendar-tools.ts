import "server-only";
import { calendarBusy, calendarCreate } from "./calendar";
import type { Profile } from "./profile";
import { localDate, openSlots, slotLabel, withinHours } from "./slots";

// The receptionist's two calendar tools, independent of the voice platform. Retell's custom-function routes and Vapi's
// tool-call route both resolve the business, then call these and send back the reply object.
export type ToolCall = { businessId: string; profile: Profile; callId?: string; args: Record<string, unknown> };
export type ToolReply = Record<string, unknown>;

// Anything that goes wrong is told to the agent in words it can act on: fall back to a request.
export const fallbackReply = (why: string): ToolReply => ({
  ok: false,
  message: `${why} Don't promise a time: take a booking request with save_caller_details and say the team will confirm.`,
});

// check_availability: open times inside opening hours that don't clash with the owner's calendar (Google or Outlook).
export async function checkAvailability(t: ToolCall): Promise<ToolReply> {
  const tz = t.profile.timezone;
  const today = localDate(Date.now(), tz);
  const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  let from = isDate(t.args.date_from) ? (t.args.date_from as string) : today;
  if (from < today) from = today;
  let to = isDate(t.args.date_to) ? (t.args.date_to as string) : from;
  if (to < from) to = from;
  const dur = Number(t.args.duration_minutes) || 60;
  try {
    const startMs = Date.parse(`${from}T00:00:00Z`) - 86400_000;
    const busy = await calendarBusy(t.businessId, startMs, Date.parse(`${to}T00:00:00Z`) + 2 * 86400_000);
    const slots = openSlots(t.profile, busy, from, to, dur);
    if (!slots.length) return { ok: true, slots: [], message: `Nothing free between ${from} and ${to} for ${dur} minutes. Offer to check other days.` };
    return {
      ok: true,
      message: "Offer two or three of these. To book one, pass its exact start value to book_appointment.",
      slots: slots.map((s) => ({ start: new Date(s.start).toISOString(), say: slotLabel(s.start, tz) })),
    };
  } catch (e) {
    console.error("availability failed:", e instanceof Error ? e.message : e);
    return fallbackReply("The calendar can't be reached right now.");
  }
}

// book_appointment: re-checks the slot is still free and inside opening hours, then writes it to the connected calendar.
export async function bookAppointment(t: ToolCall): Promise<ToolReply> {
  const a = t.args;
  const start = Date.parse(String(a.start ?? ""));
  const dur = Math.max(15, Math.min(480, Number(a.duration_minutes) || 60));
  const name = String(a.caller_name ?? "").trim().slice(0, 80);
  const phone = String(a.caller_phone ?? "").trim().slice(0, 40);
  const service = String(a.service ?? "Appointment").trim().slice(0, 80);
  if (!start || !name) return { ok: false, message: "I need the slot's exact start value from check_availability and the caller's confirmed name." };
  const end = start + dur * 60_000;
  if (start < Date.now() + 15 * 60_000) return { ok: false, message: "That time has passed or is too soon. Check availability again." };
  if (!withinHours(t.profile, start, end)) return { ok: false, message: "That's outside opening hours. Check availability again." };
  try {
    const busy = await calendarBusy(t.businessId, start - 60_000, end + 60_000);
    if (busy.some((b) => start < b.end && end > b.start)) return { ok: false, message: "Sorry, that slot was just taken. Check availability again and offer another time." };
    const r = t.profile.receptionist.name || "Maya";
    await calendarCreate(t.businessId, {
      start, end, timeZone: t.profile.timezone, callId: t.callId,
      summary: `${service}: ${name}`,
      description: [`Booked by ${r} (Pulse) on a phone call.`, phone && `Phone: ${phone}`, a.notes && `Notes: ${String(a.notes).slice(0, 500)}`].filter(Boolean).join("\n"),
    });
    return { ok: true, message: `Booked: ${service} for ${name}, ${slotLabel(start, t.profile.timezone)}. Confirm this to the caller.` };
  } catch (e) {
    console.error("booking failed:", e instanceof Error ? e.message : e);
    return fallbackReply("The booking couldn't be saved.");
  }
}

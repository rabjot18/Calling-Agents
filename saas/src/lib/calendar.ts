import "server-only";
import { db } from "./db";
import { busyTimes as gBusy, createEvent as gCreate, disconnectGoogle } from "./google";
import { msBusyTimes, msCreateEvent, msDisconnect } from "./microsoft";

// One calendar per business (Google or Outlook). The booking tools talk to whichever is connected.
export type Provider = "google" | "microsoft";
export const PROVIDER_NAME: Record<Provider, string> = { google: "Google Calendar", microsoft: "Outlook Calendar" };

export function activeProvider(businessId: string): Provider | null {
  const r = db.prepare("SELECT provider FROM connections WHERE business_id = ? AND provider IN ('google','microsoft') AND status = 'ok' ORDER BY updated_at DESC LIMIT 1").get(businessId) as
    | { provider: Provider }
    | undefined;
  return r?.provider ?? null;
}

export async function calendarBusy(businessId: string, from: number, to: number) {
  const p = activeProvider(businessId);
  if (!p) throw new Error("No calendar connected.");
  return p === "google" ? gBusy(businessId, from, to) : msBusyTimes(businessId, from, to);
}

export async function calendarCreate(businessId: string, e: { start: number; end: number; timeZone: string; summary: string; description: string; callId?: string }) {
  const p = activeProvider(businessId);
  if (!p) throw new Error("No calendar connected.");
  return p === "google" ? gCreate(businessId, e) : msCreateEvent(businessId, e);
}

// Connecting one calendar replaces the other.
export async function disconnectOtherCalendar(businessId: string, keep: Provider) {
  if (keep === "microsoft") await disconnectGoogle(businessId);
  else msDisconnect(businessId);
}

import "server-only";
import { db, now } from "./db";
import { open, seal } from "./secrets";

// Google Calendar for live booking (docs/google-calendar.md). OAuth web-server flow; refresh token sealed in `connections`.
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events.owned",
];
const CAL = "https://www.googleapis.com/calendar/v3";

export const googleAvailable = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.TOKEN_KEY);
// Retell calls our tool endpoints from its servers, so live booking needs a public https APP_URL.
export const publicUrl = () => ((process.env.APP_URL ?? "").startsWith("https://") ? process.env.APP_URL! : null);
const redirectUri = () => `${process.env.APP_URL}/api/google/callback`;

export function authUrl(state: string, loginHint?: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // always returns a refresh token
    include_granted_scopes: "true",
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type TokenRes = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string; error?: string; error_description?: string };

async function token(body: Record<string, string>): Promise<TokenRes> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as TokenRes;
  if (!res.ok) throw new GoogleError(res.status, data.error_description || data.error || "token request failed");
  return data;
}

export class GoogleError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Code → tokens; returns the account email from the id_token (came straight from Google over TLS, so no signature check needed).
export async function connectWithCode(businessId: string, code: string): Promise<string> {
  const t = await token({ code, redirect_uri: redirectUri(), grant_type: "authorization_code" });
  if (!t.refresh_token) throw new GoogleError(400, "Google didn't return a refresh token. Try connecting again.");
  const granted = (t.scope ?? "").split(" ");
  if (!granted.includes(SCOPES[2]) || !granted.includes(SCOPES[3])) throw new GoogleError(400, "Calendar access wasn't granted. Tick both calendar boxes on Google's screen.");
  let email = "";
  try {
    email = JSON.parse(Buffer.from((t.id_token ?? "").split(".")[1] ?? "", "base64url").toString()).email ?? "";
  } catch {}
  db.prepare(
    `INSERT INTO connections (business_id, provider, account, secret_enc, scope, status, created_at, updated_at)
     VALUES (?, 'google', ?, ?, ?, 'ok', ?, ?)
     ON CONFLICT(business_id, provider) DO UPDATE SET account=excluded.account, secret_enc=excluded.secret_enc, scope=excluded.scope, status='ok', updated_at=excluded.updated_at`
  ).run(businessId, email, seal(t.refresh_token), t.scope ?? "", now(), now());
  cache.set(businessId, { token: t.access_token, until: now() + (t.expires_in - 60) * 1000 });
  return email;
}

export type Connection = { account: string; status: string; connectedAt: number };
export function googleConnection(businessId: string): Connection | null {
  const r = db.prepare("SELECT account, status, created_at FROM connections WHERE business_id = ? AND provider = 'google'").get(businessId) as
    | { account: string; status: string; created_at: number }
    | undefined;
  return r ? { account: r.account, status: r.status, connectedAt: r.created_at } : null;
}

const cache = new Map<string, { token: string; until: number }>();
async function accessToken(businessId: string): Promise<string> {
  const c = cache.get(businessId);
  if (c && c.until > now()) return c.token;
  const r = db.prepare("SELECT secret_enc FROM connections WHERE business_id = ? AND provider = 'google'").get(businessId) as { secret_enc: string } | undefined;
  if (!r) throw new GoogleError(404, "Google Calendar isn't connected.");
  try {
    const t = await token({ refresh_token: open(r.secret_enc), grant_type: "refresh_token" });
    cache.set(businessId, { token: t.access_token, until: now() + (t.expires_in - 60) * 1000 });
    return t.access_token;
  } catch (e) {
    // invalid_grant = revoked or expired (Testing-mode tokens die after 7 days): show it as disconnected.
    if (e instanceof GoogleError && e.status === 400) db.prepare("UPDATE connections SET status = 'expired', updated_at = ? WHERE business_id = ? AND provider = 'google'").run(now(), businessId);
    throw e;
  }
}

async function gfetch<T>(businessId: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(CAL + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(businessId)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new GoogleError(res.status, data.error?.message ?? `Google Calendar ${res.status}`);
  return data;
}

export async function disconnectGoogle(businessId: string) {
  const r = db.prepare("SELECT secret_enc FROM connections WHERE business_id = ? AND provider = 'google'").get(businessId) as { secret_enc: string } | undefined;
  if (r) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: open(r.secret_enc) }), signal: AbortSignal.timeout(8_000) });
    } catch {} // revoking is best effort; the row goes either way
  }
  db.prepare("DELETE FROM connections WHERE business_id = ? AND provider = 'google'").run(businessId);
  cache.delete(businessId);
}

export async function busyTimes(businessId: string, from: number, to: number): Promise<{ start: number; end: number }[]> {
  const d = await gfetch<{ calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }> }>(businessId, "/freeBusy", {
    timeMin: new Date(from).toISOString(),
    timeMax: new Date(to).toISOString(),
    items: [{ id: "primary" }],
  });
  const cal = d.calendars?.primary;
  if (cal?.errors?.length) throw new GoogleError(502, `Calendar error: ${cal.errors[0].reason}`);
  return (cal?.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

export async function createEvent(businessId: string, e: { start: number; end: number; timeZone: string; summary: string; description: string; callId?: string }) {
  const iso = (ms: number) => new Date(ms).toISOString();
  return gfetch<{ id: string; htmlLink: string }>(businessId, "/calendars/primary/events?sendUpdates=none", {
    summary: e.summary,
    description: e.description,
    start: { dateTime: iso(e.start), timeZone: e.timeZone },
    end: { dateTime: iso(e.end), timeZone: e.timeZone },
    extendedProperties: { private: { pulse: "1", ...(e.callId ? { pulse_call_id: e.callId } : {}) } },
  });
}


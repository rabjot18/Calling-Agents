import "server-only";
import { db, now } from "./db";
import { open, seal } from "./secrets";

// Outlook / Microsoft 365 calendar via Microsoft Graph (docs/outlook-calendar.md). Works for personal and work accounts:
// free/busy comes from /me/calendarView (getSchedule doesn't support personal accounts). Refresh tokens rotate.
const AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = ["openid", "email", "profile", "offline_access", "https://graph.microsoft.com/Calendars.ReadWrite"];

export const microsoftAvailable = () => Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.TOKEN_KEY);
const redirectUri = () => `${process.env.APP_URL}/api/microsoft/callback`;

export class MicrosoftError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function msAuthUrl(state: string, loginHint?: string) {
  const q = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
    prompt: "select_account",
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `${AUTH}/authorize?${q}`;
}

type TokenRes = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string; error?: string; error_description?: string };
async function token(body: Record<string, string>): Promise<TokenRes> {
  const res = await fetch(`${AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID!, client_secret: process.env.MICROSOFT_CLIENT_SECRET!, scope: SCOPES.join(" "), ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as TokenRes;
  if (!res.ok) throw new MicrosoftError(res.status, (data.error_description || data.error || "token request failed").split("\r\n")[0]);
  return data;
}

const cache = new Map<string, { token: string; until: number }>();
const store = (businessId: string, refresh: string) =>
  db.prepare("UPDATE connections SET secret_enc = ?, updated_at = ? WHERE business_id = ? AND provider = 'microsoft'").run(seal(refresh), now(), businessId);

export async function msConnectWithCode(businessId: string, code: string): Promise<string> {
  const t = await token({ code, redirect_uri: redirectUri(), grant_type: "authorization_code" });
  if (!t.refresh_token) throw new MicrosoftError(400, "Microsoft didn't return a refresh token. Try connecting again.");
  if (!/Calendars\.ReadWrite/i.test(t.scope ?? "")) throw new MicrosoftError(400, "Calendar access wasn't granted.");
  let email = "";
  try {
    const c = JSON.parse(Buffer.from((t.id_token ?? "").split(".")[1] ?? "", "base64url").toString());
    email = c.email || c.preferred_username || "";
  } catch {}
  db.prepare(
    `INSERT INTO connections (business_id, provider, account, secret_enc, scope, status, created_at, updated_at)
     VALUES (?, 'microsoft', ?, ?, ?, 'ok', ?, ?)
     ON CONFLICT(business_id, provider) DO UPDATE SET account=excluded.account, secret_enc=excluded.secret_enc, scope=excluded.scope, status='ok', updated_at=excluded.updated_at`
  ).run(businessId, email, seal(t.refresh_token), t.scope ?? "", now(), now());
  cache.set(businessId, { token: t.access_token, until: now() + (t.expires_in - 60) * 1000 });
  return email;
}

export type MsConnection = { account: string; status: string; connectedAt: number };
export function msConnection(businessId: string): MsConnection | null {
  const r = db.prepare("SELECT account, status, created_at FROM connections WHERE business_id = ? AND provider = 'microsoft'").get(businessId) as
    | { account: string; status: string; created_at: number }
    | undefined;
  return r ? { account: r.account, status: r.status, connectedAt: r.created_at } : null;
}

async function accessToken(businessId: string): Promise<string> {
  const c = cache.get(businessId);
  if (c && c.until > now()) return c.token;
  const r = db.prepare("SELECT secret_enc FROM connections WHERE business_id = ? AND provider = 'microsoft'").get(businessId) as { secret_enc: string } | undefined;
  if (!r) throw new MicrosoftError(404, "Outlook isn't connected.");
  try {
    const t = await token({ refresh_token: open(r.secret_enc), grant_type: "refresh_token" });
    if (t.refresh_token) store(businessId, t.refresh_token); // rotation: keep the newest, drop the old
    cache.set(businessId, { token: t.access_token, until: now() + (t.expires_in - 60) * 1000 });
    return t.access_token;
  } catch (e) {
    if (e instanceof MicrosoftError && e.status === 400) db.prepare("UPDATE connections SET status = 'expired', updated_at = ? WHERE business_id = ? AND provider = 'microsoft'").run(now(), businessId);
    throw e;
  }
}

async function graph<T>(businessId: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url.startsWith("http") ? url : GRAPH + url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(businessId)}`, "Content-Type": "application/json", Prefer: 'outlook.timezone="UTC"', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(8_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new MicrosoftError(res.status, data.error?.message ?? `Microsoft Graph ${res.status}`);
  return data;
}

// Busy = any non-cancelled event not marked "free" (tentative counts as busy, like Outlook's own scheduling).
export async function msBusyTimes(businessId: string, from: number, to: number) {
  const out: { start: number; end: number }[] = [];
  let url: string | undefined = `/me/calendarView?startDateTime=${new Date(from).toISOString()}&endDateTime=${new Date(to).toISOString()}&$select=start,end,showAs,isCancelled&$top=100`;
  for (let page = 0; url && page < 10; page++) {
    const d: { value?: { start: { dateTime: string }; end: { dateTime: string }; showAs?: string; isCancelled?: boolean }[]; "@odata.nextLink"?: string } = await graph(businessId, url);
    for (const e of d.value ?? []) {
      if (e.isCancelled || e.showAs === "free") continue;
      out.push({ start: Date.parse(e.start.dateTime + "Z"), end: Date.parse(e.end.dateTime + "Z") }); // UTC via the Prefer header
    }
    url = d["@odata.nextLink"];
  }
  return out;
}

export async function msCreateEvent(businessId: string, e: { start: number; end: number; summary: string; description: string; callId?: string }) {
  const utc = (ms: number) => new Date(ms).toISOString().slice(0, 19);
  return graph<{ id: string; webLink: string }>(businessId, "/me/events", {
    method: "POST",
    body: JSON.stringify({
      subject: e.summary,
      body: { contentType: "text", content: e.description },
      start: { dateTime: utc(e.start), timeZone: "UTC" },
      end: { dateTime: utc(e.end), timeZone: "UTC" },
      transactionId: `pulse-${e.callId ?? "x"}-${e.start}`, // Graph de-duplicates retries with the same id
    }),
  });
}

// Microsoft has no simple refresh-token revocation endpoint for this flow; the owner can also remove Pulse at account.live.com/consent.
export function msDisconnect(businessId: string) {
  db.prepare("DELETE FROM connections WHERE business_id = ? AND provider = 'microsoft'").run(businessId);
  cache.delete(businessId);
}

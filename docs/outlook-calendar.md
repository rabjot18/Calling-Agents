# Outlook / Microsoft 365 Calendar (live booking for Pulse)

Last verified: 2026-11-18 (official Microsoft docs read via web fetch; app registration not yet created — operator blocked by tenant error, see Gotchas)

## Use in Pulse
- Owner clicks Connect Outlook → Microsoft sign-in (personal or work account) → encrypted refresh token in `connections` (provider `microsoft`).
  Code: `saas/src/lib/microsoft.ts`, routes `/api/microsoft/*`. One calendar per business: connecting Outlook removes Google and vice versa (`lib/calendar.ts`).
- Same booking tools as Google (`/api/tools/calendar/*`), routed through `lib/calendar.ts`.
- Env: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (Entra app registration, Web platform, redirect `<APP_URL>/api/microsoft/callback`,
  supported accounts = any Entra tenant + personal Microsoft accounts).

## OAuth (v2 auth code flow)
- Authorize: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` — `client_id, response_type=code, redirect_uri, response_mode=query, scope, state` (+ `prompt=select_account`).
- Token: `POST https://login.microsoftonline.com/common/oauth2/v2.0/token` — exchange `client_id, client_secret, code, redirect_uri, grant_type=authorization_code, scope`;
  refresh `client_id, client_secret, refresh_token, grant_type=refresh_token, scope` (same or subset).
- Refresh tokens **rotate**: the response can carry a new `refresh_token`; store it and drop the old (Pulse re-seals it on every refresh). No fixed lifetime for web apps.
- `refresh_token` only with `offline_access`. `id_token` with `openid`; email from `email` or `preferred_username` claim.
- No revocation endpoint in this flow: disconnect just deletes our token; owners can also remove Pulse at account.live.com/consent (personal) or myapps.microsoft.com (work).

## Scopes
`openid email profile offline_access https://graph.microsoft.com/Calendars.ReadWrite` — Calendars.ReadWrite is the least privilege that can create events;
delegated, admin consent not required (tenant policy can still block user consent).

## Calls (Graph v1.0)
- Busy times: `GET /me/calendarView?startDateTime&endDateTime&$select=start,end,showAs,isCancelled&$top=100`, header `Prefer: outlook.timezone="UTC"`,
  follow `@odata.nextLink`. Busy = not cancelled and `showAs` ≠ `free`. **`/me/calendar/getSchedule` does NOT support personal accounts** — don't use it.
- Create: `POST /me/events` `{subject, body:{contentType:"text",content}, start:{dateTime,timeZone:"UTC"}, end:{…}, transactionId}` → 201 with `id`, `webLink`.
  `transactionId` de-duplicates retries.

## Gotchas
- **"Selected user account does not exist in tenant 'Microsoft Services'…"** when opening entra.microsoft.com with a personal Microsoft account
  (e.g. one created with a Gmail address): personal accounts have no directory. Create a free Azure account (azure.microsoft.com/free) to get a
  "Default Directory", then use portal.azure.com › App registrations — or use a work/school Microsoft 365 account. (Seen 2026-11-18.)
- Client secrets expire (max ~24 months in the portal) — put a reminder in the calendar.

## Key test
After an owner connects: refresh the token, then calendarView for the next 24 h (read-only). Not yet run.

Sources: learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow, /graph/api/user-list-calendarview, /graph/api/calendar-getschedule,
/graph/api/user-post-events, /graph/permissions-reference.

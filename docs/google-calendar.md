# Google Calendar (live booking for Pulse)

Last verified: 2026-11-17 (docs read; OAuth client created by the operator and checked)

## Use in Pulse
- Owner connects their Google account (OAuth web-server flow); Pulse stores an encrypted refresh token per business
  (`connections` table, AES-256-GCM with `TOKEN_KEY`). Code: `saas/src/lib/google.ts`, routes `/api/google/*`.
- The receptionist gets two Retell custom functions (`/api/tools/calendar/availability`, `/api/tools/calendar/book`),
  signed with `X-Retell-Signature`. They only work when `APP_URL` is a public https URL (Retell calls them from its servers).
- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (operator's Google Cloud OAuth client, type "Web application").
  Authorized redirect URI: `<APP_URL>/api/google/callback` (http://localhost:3100/api/google/callback locally).

## OAuth
- Authorize: `https://accounts.google.com/o/oauth2/v2/auth` with `client_id`, `redirect_uri` (exact match), `response_type=code`,
  `scope` (space-separated), `access_type=offline`, `prompt=consent` (forces a refresh token every time), `state`, `include_granted_scopes=true`.
- Token: `POST https://oauth2.googleapis.com/token`, form body. Exchange: `code, client_id, client_secret, redirect_uri, grant_type=authorization_code`.
  Refresh: `client_id, client_secret, refresh_token, grant_type=refresh_token`. Refresh token only comes back with `access_type=offline` (first consent, or `prompt=consent`).
- Revoke: `POST https://oauth2.googleapis.com/revoke` with `token`.
- Account email: request `openid email`; the `id_token` carries `email`/`email_verified` (key users by `sub`).

## Scopes used
`openid email https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events.owned`
(freebusy = view availability only; events.owned = create events on calendars the user owns). Sensitive/restricted classification
was not stated on the docs pages — check Cloud Console › Data Access.

## Calls
- Free/busy: `POST https://www.googleapis.com/calendar/v3/freeBusy` `{timeMin, timeMax, timeZone, items:[{id:"primary"}]}` →
  `calendars.primary.busy[{start,end}]` (end exclusive), `calendars.primary.errors`.
- Create: `POST https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none`
  `{summary, description, start:{dateTime, timeZone}, end:{dateTime, timeZone}, extendedProperties:{private:{pulse_call_id}}}`.

## Gotchas
- **Testing mode tokens expire after 7 days** ("refresh token expiring in 7 days" for External apps in Testing, unless only openid/email/profile).
  Publish the consent screen ("In production") before real owners connect, or they'll silently disconnect after a week.
- Unverified apps show the "Google hasn't verified this app" screen until verification is submitted.
- "Access blocked: … has not completed the Google verification process" (Error 403 access_denied) = the signing-in account isn't on Audience › Test users. Add it (or publish the app). Seen 2026-11-18.
- Test-user limit for Testing mode wasn't stated on the pages read — don't rely on a remembered number.
- Max 100 refresh tokens per account per client; older ones are revoked silently.

## Key test
2026-11-17 client check: GET the authorize URL with the client id + `http://localhost:3100/api/google/callback` → HTTP 302 to Google sign-in (a bad client/redirect returns an error page: `invalid_client` / `redirect_uri_mismatch`). Per-business test below runs after an owner connects.
2026-11-18 per-business test (operator's own Google account, Testing mode, test user added): token refresh OK, `freeBusy` primary next 24 h → HTTP 200, 1 busy block. **Valid.**
After a business connects: refresh the access token, then `freeBusy` for the next 24 h (read-only).

Sources: developers.google.com/identity/protocols/oauth2/web-server, /identity/protocols/oauth2/openid-connect,
/workspace/calendar/api/v3/reference/freebusy/query, /events/insert, /workspace/calendar/api/auth, /workspace/guides/configure-oauth-consent.

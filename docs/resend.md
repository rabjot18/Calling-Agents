# Resend (transactional email)

Last verified: 2026-11-17 (docs read; key tested live)

## Use in Pulse
- Post-call summary email to the owner (`profile.notifyEmail`), sent once per call (`calls.notified_at`). Code: `saas/src/lib/email.ts`.
- Env: `RESEND_API_KEY` (Full access key so the key test works), optional `RESEND_FROM` (default `Pulse <onboarding@resend.dev>`).

## API
- Send: `POST https://api.resend.com/emails`, headers `Authorization: Bearer re_…`, `Content-Type: application/json`.
  Body: `from`, `to` (string or array, max 50), `subject` required; `html`, `text`, `cc`, `bcc`, `headers`, `tags` [{name,value}] optional.
  Response `{ "id": "…" }`. Reply-to field name not confirmed from the docs page (`reply_to` in the REST examples elsewhere — verify before relying on it).
- Idempotency: header `Idempotency-Key` (unique per request, 24 h, ≤256 chars). Pulse uses `call-<call_id>`.
- Rate limit 10 req/s per team → 429 `rate_limit_exceeded`.

## Key test
2026-11-17: `GET https://api.resend.com/domains` → **HTTP 200 (valid)**, one domain `getspiceitup.com` with status `failed` (DNS not verified). Then `POST /emails` from `onboarding@resend.dev` to `delivered@resend.dev` → HTTP 200 with an id.
`GET https://api.resend.com/domains` with the Bearer header (read-only). A sending-only key returns 401 `restricted_api_key` here, so use a Full access key or treat 401 restricted as "valid, sending only". Docs disagree on the invalid-key status (400/401/403).

## Limits and gotchas
- Free plan: 100 emails/day, 3,000/month, 3 domains (https://resend.com/pricing).
- Without a verified domain you can only send to your own account email (403 "You can only send testing emails to your own email address"). Verify a domain (DNS records) before owners get emails.
- Test recipients: `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev` (count toward quota).

Sources: resend.com/docs/api-reference/emails/send-email, /domains/list-domains, /errors, /introduction; /docs/dashboard/emails/send-test-emails; resend.com/pricing.

- Operator gotcha (2026-11-17): the key was first pasted onto the `RESEND_FROM` line; Claude moved it to `RESEND_API_KEY`. Check the line if a key test returns 400 "API key is invalid".

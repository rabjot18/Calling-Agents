# Twilio WhatsApp (owner alerts for Pulse)

Last verified: 2026-11-18 (Twilio docs read via web fetch; operator's keys tested live)

## Use in Pulse
- After each analysed call: WhatsApp summary to `profile.notifyWhatsApp` (once per call, `calls.wa_notified_at`; spam and calls >6 h old skipped).
- On Retell `transfer_started` webhook: instant "transferring a caller to you now" + a one-line gist from the live transcript (Gemini).
  Needs the Retell webhook, i.e. a public https `APP_URL` (agents subscribe to `call_analyzed` + `transfer_started`).
- Code: `saas/src/lib/whatsapp.ts`, `lib/notify.ts`, `/api/notify/whatsapp-test`. UI: Settings › Connections › Call summaries on WhatsApp.
- Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`; optional `TWILIO_WHATSAPP_FROM` (default sandbox `whatsapp:+14155238886`) and
  `TWILIO_WHATSAPP_CONTENT_SID` (approved template; when set, sends ContentSid + ContentVariables 1–4 instead of free text).

## Key test
2026-11-18: `GET https://api.twilio.com/2010-04-01/Accounts/{SID}.json` (basic auth SID:token) → **HTTP 200, status active, type Trial**.
Message log `GET …/Messages.json` showed 0 WhatsApp messages: the operator's sandbox "join" hadn't arrived yet (QR/link only pre-fills the text; you must tap Send).

## API
- Send: `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`, form `From=whatsapp:+…`, `To=whatsapp:+…`, `Body` (or `ContentSid` + `ContentVariables` JSON). Response `sid`, `status: queued`.
- Delivery problems appear later on the message (`status` failed/undelivered + `error_code`), so the test endpoint re-reads the message after ~2.5 s.

## Sandbox rules (https://www.twilio.com/docs/whatsapp/sandbox)
- Join: send `join <code>` to +1 415 523 8886 (shared number). Only joined numbers receive messages (error 63015 otherwise).
- **"The Sandbox session expires three days after joining"** — rejoin after that.
- Free-form only inside the 24-hour customer-service window (after the participant's last message); business-initiated messages from the sandbox
  can only use its fixed pre-approved templates. Pulse explains 63016 as "send Pulse's number any message, then try again" (code not confirmed in the docs read).
- Trial accounts include 100 WhatsApp messages; 1 message / 3 s; not for production.

## Production (launch)
- Needs a WhatsApp Business Account (WABA) on a Meta Business Portfolio (Meta Business Verification), registered through Twilio WhatsApp Self Sign-up.
  Unverified portfolios: 2 numbers; verified: up to 20. One WABA per Twilio account.
- Business-initiated messages outside 24 h need an approved template (Utility category): create "call summary" with 4 variables
  (business name, caller, caller number, summary), put its Content SID in `TWILIO_WHATSAPP_CONTENT_SID`, set `TWILIO_WHATSAPP_FROM`.
- WhatsApp requires explicit opt-in from each owner (they type their number in Settings — keep that as the opt-in record).

Sources: twilio.com/docs/whatsapp/sandbox, /docs/whatsapp/api, /docs/whatsapp/key-concepts.

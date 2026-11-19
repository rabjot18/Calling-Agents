# Retell: gaps that need a custom function

Last verified: 2026-11-16. For each common receptionist need: can Retell do it natively, and if not, what do we build?

**Hosting default for anything we build (inferred, decide per client):** one small HTTPS service per client, or a shared multi-tenant one keyed by the agent ID, deployed on a serverless platform. It verifies `X-Retell-Signature` on every request. Secrets go in `clients/<slug>/.env`. The service needs a public URL, because Retell blocks private ones.

| Need | Native? | What to use or build |
|---|---|---|
| Answer FAQs (hours, prices, services, location) | ✅ | The prompt for short facts. A knowledge base (website URL with 24 h auto-refresh, or text snippets) for longer material. |
| FAQs that change often (daily specials, staff on duty) | ✅ partly | Knowledge-base auto-refresh is daily. For anything fresher, a **custom function** `get_live_info` that reads the owner's Google Sheet or API, or a **code tool** if the data is public. |
| Check availability and book: Cal.com, Calendly or GoHighLevel | ✅ | An integration tool (Calendly has no reschedule). |
| Check availability and book: **Google Calendar or Outlook directly** | ❌ | No direct integration. Either (a) connect that calendar to a free Cal.com account and use the Cal.com tools (**preferred**, no code), or (b) build `check_availability(date_from, date_to)` returning `{slots: ["2026-11-18T14:00", ...]}` and `book_appointment(name, phone, slot, reason)` returning `{confirmed, booking_id}` against the Google or Microsoft Graph API. |
| Book into **industry software** (Jane, Mindbody, Square Appointments, Vagaro, Dentrix, ServiceTitan, Housecall Pro, Boulevard, etc.) | ❌ | A custom function per platform: `check_availability`, `book_appointment`, and optionally `find_customer` and `cancel_appointment`. Research that platform's API first. Many are partner-only or have no public API; then fall back to "take the details and text or email the owner" and record it under "couldn't do". |
| Reschedule or cancel | ✅ Cal.com, GHL · ⚠️ Calendly (cancel only) | Calendly: cancel, then book again. Other platforms: a custom function. |
| CRM lookup / create: HubSpot, Salesforce, GHL, Zoho, Dynamics, monday | ✅ | An integration tool, run as a pre-call tool for lookup and a post-call tool for logging. |
| CRM: Pipedrive, Airtable, Google Sheets, Jobber, others | ❌ | A custom function `upsert_contact` / `log_call`, run as a post-call tool. |
| Text a booking confirmation to the caller | ⚠️ | A `send_sms` tool. Custom text needs A2P 10DLC registration on our Twilio number (days to weeks). Without it, only Retell's preset template is available. If neither works, use a custom function sending through the client's own SMS provider (e.g. Twilio Messaging) **(inferred)**. |
| **Email** a confirmation, or a message to the owner | ❌ | A custom function `send_email(to, subject, body)` or a post-call webhook handler (Resend, Postmark or SMTP). |
| **Send the owner a summary or message after every call** | ❌ (data exists, delivery doesn't) | The `call_analyzed` webhook (or a post-call custom tool) sends the summary and extracted fields (caller, reason, callback number, urgency) to the owner by email or SMS. This is our standard post-call piece. |
| Take a message | ✅ | `extract_dynamic_variable` plus post-call extraction fields. Delivery uses the row above. |
| Transfer to a human or emergency line | ✅ | `transfer_call` (warm or cold). Set the number's `fallback_number` too. |
| After-hours behaviour | ✅ mostly | The prompt uses `{{current_time}}` and `{{current_calendar}}` with the agent's `timezone`, which is enough for "we're closed, take a message". For a separate after-hours agent, holiday calendars, or a schedule the owner edits, use the **inbound call webhook** (custom endpoint) returning `override_agent_id` or `dynamic_variables: {is_open: "false"}`. |
| On-call escalation (who's on call tonight) | ❌ | A custom function `get_on_call_number()`, or the inbound webhook sets `{{on_call_number}}` for the transfer destination. |
| Multi-location routing | ✅ partly | One number per location, each bound to its own agent or variables. For a single shared number: an inbound webhook that sets `{{location}}`, or the agent asks the caller and uses an `inferred` transfer destination. |
| Spam / blocklist | ✅ partly | Inbound webhook `reject: true` for listed numbers (custom endpoint). Do-not-call detection is built in. |
| Take payments or deposits | ❌ (not for our use) | Retell has a PCI "payment agent" mode (seen in create-web-call), but it isn't documented for phone receptionists. Default: a custom function `send_payment_link(phone, amount)` (e.g. Stripe Payment Link sent by SMS or email). Never collect card numbers by voice. |
| Order or job status lookup | ❌ | A custom function against the client's system. |
| Quote calculation (price by size or distance) | ✅ | A code tool, with no server needed. |
| Caller memory across calls | ✅ | `contact_memory_config` and Contacts. |
| Call recordings and transcripts for the owner | ✅ partly | Available through the dashboard or `get-call`. For the owner to get them without dashboard access, include the link in the post-call summary (with signed URLs on). |
| HIPAA (medical, dental, therapy) | ✅ with a BAA | The owner or operator must self-sign Retell's BAA before go-live. Set `data_storage_setting` to `everything_except_pii` and use `pii_config`. That's an owner action and should be flagged in the report. |

## Standard custom pieces to build once and reuse
1. **Post-call notifier:** `call_analyzed` webhook → email/SMS to the owner with a summary, caller details, reason, urgency and a recording link. Needed by almost every client.
2. **Calendar bridge:** for clients on Google or Outlook without Cal.com. Prefer setting up Cal.com over building this.
3. **Inbound router:** the inbound webhook, for after-hours or holiday overrides, blocklists and location routing. Build it only when the prompt-based approach isn't enough.

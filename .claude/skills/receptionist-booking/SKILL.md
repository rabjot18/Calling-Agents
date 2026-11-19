---
name: receptionist-booking
description: Receptionist module for booking new appointments on Retell. Covers availability checks and booking through native Cal.com, Calendly or GoHighLevel tools, or a Vercel custom function for other calendars and booking software, plus the prompt section, extraction fields and test cases. Loaded by build-receptionist when the business takes appointments.
---

# Module: booking

## Owner facts needed (feed into research-business questions; defaults in brackets)
- Which system holds the calendar [whatever the booking link on their website reveals].
- Which services the agent may book, and how long each takes [the published services, with industry-typical lengths].
- What to collect [name, phone (default `{{user_number}}`), service, new or returning, plus anything the industry needs, such as an address for home services or the pet's name for a vet].
- Booking rules: lead time, booking horizon, deposits [no same-day bookings; up to 30 days ahead; mention deposits but never take payment].

## Implementation (use the first that fits)
1. **Cal.com:** `create-app {type: "calendar", provider: "calcom", auth_config: <api key>}`. Then two `integration_app` tools, `check_calcom_availability` and `book_calcom_appointment`, each pinned to the event type ID (one pair per service if lengths differ) and the client's timezone. Get the parameter shape from `get-app-tool-schema`.
2. **Calendly:** `check_calendly_availability` and `book_calendly_appointment` (API key).
3. **GoHighLevel:** `check_ghl_availability` and `book_ghl_appointment` (API key plus Location ID). Also creates or updates the contact.
4. **Google or Outlook calendar only:** walk the operator through a free Cal.com account connected to that calendar, then use option 1. This avoids custom code.
5. **Other booking software** (Jane, Mindbody, Vagaro, Square, ServiceTitan, Housecall Pro, Dentrix…): research its API into `docs/<software>.md`. If there's a usable API, build custom functions on Vercel:
   - `check_availability {service, date_from, date_to}` → `{ok, slots: ["2026-11-18T14:00", …] (≤6, in the client's timezone), message}`
   - `book_appointment {service, slot, name, phone, notes}` → `{ok, booking_id, confirmed_time, message}`. Make it idempotent on `call_id + slot`, and re-check the slot is free before booking.

   If there's no API: **booking request mode.** No booking tool; collect the details and the preferred times, and the lead-capture notifier sends them to the owner to confirm. Say so in the report.

**Tool settings:** `speak_during_execution: true` with a static "One moment while I check the calendar." For custom functions, `timeout_ms` 10000 and `max_retry: 0`. Map `response_variables` such as `booking_id` and `confirmed_time`.

## Prompt section
```
## Booking appointments
- Ask what they'd like to book, then collect: {{FIELDS}}. Use the caller's number {{user_number}} unless they give another.
- Ask when suits them, then call check_availability for that window. Offer at most three specific times in plain words ("Tuesday at 2 pm").
- When they pick one, read back the service, day, time and name, and ask "Shall I book that?" Only call book_appointment after a clear yes.
- After booking, confirm the time once more and tell them {{CONFIRMATION_NOTE}}.
- If nothing suits them, or the calendar tool fails, take their details and preferred times, and say the team will call back to confirm.
- Never invent availability, and never promise a time you haven't booked.
```
`{{CONFIRMATION_NOTE}}` is "you'll get a confirmation by email or text" only if the booking system really sends one. Otherwise leave it out.

## Extraction fields (`post_call_analysis_data`)
`appointment_booked` (boolean), `appointment_time` (text), `service_requested` (text), `booking_failed_reason` (text).

## Test cases
1. Happy path: a caller books a specific service, picks the 2nd offered slot, and confirms. Pass if availability was checked before times were offered, details were read back, book was called only after "yes", and the call ended with end_call.
2. Nothing suits: the caller rejects every slot. Pass if the agent took details and preferred times and no booking was made.
3. Tool failure (mock availability returning `{ok: false}`). Pass if the agent apologises once, takes a message, and doesn't invent times.
4. Change of mind before confirming. Pass if no booking was made with the old details.

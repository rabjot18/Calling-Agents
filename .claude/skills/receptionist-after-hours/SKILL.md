---
name: receptionist-after-hours
description: Receptionist module for after-hours and holiday behaviour on Retell. The same agent switches behaviour using the agent timezone and time variables; holidays come from prompt dates or, when schedules change often, a custom inbound webhook on Vercel that sets is_open or swaps the agent. Covers emergency handling outside hours, extraction fields and test cases. Loaded by build-receptionist when the business has opening hours.
---

# Module: after-hours

## Owner facts needed (defaults in brackets)
- Opening hours per day, and the holiday closures for the next 12 months [from Google or the website; standard national holidays closed].
- What to do after hours: take a message, book (if self-booking is allowed), or transfer emergencies to someone on call [take messages and book where booking is enabled; emergencies follow the transfer module, otherwise the industry's standard emergency guidance].
- Whether to answer at all after hours [yes; the AI answers 24/7].

## Implementation
1. **Native time logic (default):** set the agent `timezone` to the client's IANA zone. The prompt gets the hours table plus the built-ins `{{current_time}}` (e.g. "Thursday, March 28, 2024 at 11:46 PM PDT") and `{{current_calendar}}` (the next 14 days). The LLM decides open or closed itself. List holiday closures as dates in the prompt.
2. **Inbound webhook (custom; only when hours change often, a holiday calendar is long, or after-hours needs a different agent or voice):** a Vercel `api/inbound.js` set as the number's `inbound_webhook_url`. It:
   - Verifies the signature.
   - Computes open or closed from `clients/<slug>/functions/hours.json` (the weekly hours plus holidays; the owner can ask us to edit it).
   - Responds within 10 s with `{"call_inbound": {"dynamic_variables": {"is_open": "true|false", "next_open": "Monday at 9 am"}}}`, or adds `override_agent_id` for a separate after-hours agent.
   - On error it returns `{}` quickly, so the call proceeds with the default agent.

   The prompt then trusts `{{is_open}}` and `{{next_open}}` instead of working them out.
3. Booking stays available after hours if the booking module is in. Transfers follow the transfer module's hours.

## Prompt section
```
## Opening hours
Our hours ({{TIMEZONE_NAME}}): {{HOURS_TABLE}}. Closed: {{HOLIDAYS}}.
It is now {{current_time}}. Next two weeks: {{current_calendar}}.
- First work out whether we're open right now. When closed, say so briefly at the start: "We're closed right now; we open again {{next opening}}. I can still help."
- When closed: answer questions, book appointments if available, and take messages. Say the team will call back after opening.
- Emergencies when closed: {{AFTER_HOURS_EMERGENCY_ACTION}}.
- When someone asks "are you open on <day>?", answer from the hours and closures above. Never guess.
```
(With option 2, replace the first bullet with: "We are open right now: {{is_open}}. Next opening: {{next_open}}.")

## Extraction fields
`called_after_hours` (boolean), `after_hours_request` (selector: message \| booking \| emergency \| info).

## Test cases
Set `current_time` through the test's dynamic variables where supported. Otherwise set `is_open`/`next_open` (option 2), or phrase the persona as calling at a stated time.
1. Closed on a weekday evening. Pass if the agent said it was closed and gave the next opening, then took a message.
2. Closed, with an emergency. Pass if the after-hours emergency action was followed.
3. A holiday question ("are you open on Christmas Day?"). Pass if the answer matches the holiday list.
4. Open during hours. Pass if the agent did not say "we're closed".

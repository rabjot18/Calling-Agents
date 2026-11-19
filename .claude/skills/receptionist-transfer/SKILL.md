---
name: receptionist-transfer
description: Receptionist module for transferring calls to a human on Retell. Covers emergency escalation, "speak to a person" requests and department routing using the native transfer_call tool (warm, cold or agentic warm), the number's fallback and backup mode, and a custom on-call lookup only when the target changes by schedule. Includes the prompt section, extraction fields and test cases. Loaded by build-receptionist for every client.
---

# Module: transfer

## Owner facts needed (defaults in brackets)
- Who takes transferred calls, at what number, and during which hours [the business's main line during opening hours; otherwise take an urgent message].
- What counts as an emergency for this business [the industry triage list from `docs/business-types/<type>.md`].
- Whether a caller can ask for a person for any reason [yes during hours, after trying to help once].
- Departments or people callers ask for by name [none].

## Implementation (all native unless noted)
1. **The `transfer_call` tool:**
   - Default to `warm_transfer` with `private_handoff_option` (a whisper to staff such as "{{caller_name}} calling about {{reason}}"), `on_hold_music: "ringtone"`, `transfer_ring_duration_ms: 25000`, and `speak_during_execution: true` with a static "I'll connect you now, one moment."
   - Use `cold_transfer` (sip_invite) if the destination is an answering service or phone menu.
   - Use `agentic_warm_transfer` only if the owner wants staff to be able to decline calls. That needs a separate transfer agent, `is_transfer_agent: true`.
2. **Several destinations:** one `transfer_call` tool per destination with clear names (`transfer_to_emergency`, `transfer_to_billing`), or a single tool with `transfer_destination: {type: "inferred", prompt: "<name → number list>"}`.
3. **Fallback on the number** (always): `fallback_number` = the main destination, which catches concurrency overflow. In an incident, Backup mode (`inbound_fallback_enabled: true`) sends every call straight to staff. Document how to turn it on in REPORT.md's "Your steps".
4. **On-call schedules** (custom, only when the target changes by time or roster): a Vercel function `get_on_call {}` → `{ok, number, name}`, saving `response_variables: {"on_call_number": "number"}`. The transfer tool uses `{"type": "predefined", "number": "{{on_call_number}}"}`. Or use the inbound webhook to set `{{on_call_number}}` before the call starts.
5. **Caller ID:** keep the agent's number shown (the default) unless the owner needs to see the caller's own number. Showing the caller's number needs a Twilio number, or the transfer fails.

Transfers only work on phone calls, not web calls. Simulation tests fake them, so prove one with a real call during the go-live check.

## Prompt section
```
## Transfers and emergencies
- Emergencies are: {{EMERGENCY_LIST}}. If the caller describes one: {{EMERGENCY_ACTION}} (for life-threatening situations, always tell them to hang up and call 911 first).
- If someone asks for a person, try to help once. If they still want a person, transfer during {{TRANSFER_HOURS}}; otherwise take a message.
- Before transferring, get their name and reason (unless it's an emergency, in which case transfer immediately), and say "I'll connect you now."
- If the transfer doesn't connect, apologise, take their details, and say someone will call back as soon as possible. Mark it urgent if it was an emergency.
```

## Extraction fields
`transfer_requested` (boolean), `transfer_reason` (selector: emergency \| asked_for_human \| department \| other), `transfer_connected` (boolean, inferred from the transcript), `emergency_described` (text).

## Test cases
1. Emergency (mock the transfer as successful). Pass if the transfer was attempted immediately without lengthy questions, and 911 was advised if it's life-threatening.
2. Asks for a human during hours. Pass if the agent offered help once, then transferred.
3. Asks for a human after hours. Pass if there was no transfer and a message was taken.
4. Transfer fails (mock the transfer as failed). Pass if the agent apologised, took details and marked urgency.
5. Live (after go-live): one real call says "I need to speak to someone". Pass if the destination phone rings and hears the whisper.

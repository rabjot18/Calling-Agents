---
name: receptionist-lead-capture
description: Receptionist module for taking messages and capturing new-customer leads on Retell, plus delivering them to the owner after every call. Uses native CRM integrations (HubSpot, GoHighLevel, Salesforce, Zoho, Dynamics) as pre- and post-call tools where the client has one, otherwise a Vercel notifier on the call_analyzed webhook that emails or texts the owner. Includes the prompt section, extraction fields and test cases. Loaded by build-receptionist for every client; it is also the fallback for every other module.
---

# Module: lead capture and owner notification

## Owner facts needed (defaults in brackets)
- Where messages and leads should go: email, text, or their CRM [email to the address on their website or Google profile].
- What to capture from a new enquiry [name, callback number, what they need, how urgent, best time to call back; plus the industry essentials from `docs/business-types/<type>.md`].
- How fast they promise a callback [say "as soon as possible"; never promise a specific time unless the owner says so].

## Implementation
**A. Capture during the call (native, always):**
- An `extract_dynamic_variable` tool `save_caller_details` with variables `caller_name`, `callback_number`, `reason`, `urgency` (low\|normal\|urgent) and `best_time`.
- Plus `post_call_analysis_data` (see below). That data arrives with the `call_analyzed` event.

**B. Look up existing customers before the agent speaks (native, if the client has a supported CRM):** a `pre_session_tools` entry such as `search_hubspot_contact`, `search_ghl_contact` or `search_salesforce_contact`, with the phone fixed to `{{user_number}}` and `response_variables` such as `{"customer_first_name": "...", "contact_id": "..."}`. The prompt greets returning customers by name only if a match is found.

**C. Deliver to the owner (choose the first that fits):**
1. **The client's CRM (native):** a `post_session_tools` entry, e.g. `create_hubspot_contact` (if there was no match), then `log_hubspot_call` or `create_hubspot_note`, or the GHL, Salesforce or Zoho equivalents, gated on a condition such as "a message was left or this is a new lead". Also turn on the CRM's own task or notification for the owner.
2. **Email or text the owner (custom; most clients):** a Vercel endpoint `api/notify_owner.js` set as the agent's `webhook_url` with `webhook_events: ["call_analyzed"]`. It:
   - Verifies the signature (`readVerified`) and deduplicates on `event + call_id`.
   - Builds a message: urgency first, then the caller's name, number, reason, best time, whether a booking was made, the call summary, and the recording link if signed URLs are on.
   - Sends **email** through an email API. The default is Resend; it needs `RESEND_API_KEY` in the root `.env` (a platform key, so rule 7 applies; if it's missing, add an operator walkthrough), and the `to` address goes in the client `.env`. It sends **SMS** to the owner only if the client gives Twilio credentials or our A2P registration is approved.
   - Returns 204 quickly, doing the work before responding but within the 10-second limit.
   - Skips calls with no conversation (`disconnection_reason` such as dial_no_answer) and spam (`call_analysis.custom_analysis_data.is_spam`).
3. **Fallback if nothing is configured yet:** the owner reads calls in the Retell dashboard. Add a walkthrough and list it under "couldn't do".

## Prompt section
```
## Taking messages and new enquiries
- When someone wants a callback, is a new customer, or you can't help directly: get their name, the best number (confirm {{user_number}} or take another, reading it back digit by digit), what it's about, and the best time to call. Then call save_caller_details.
- Never assume how a name is spelled. Spell the first name back letter by letter with an easy word for each letter ("H for helicopter, A for apple, R for rat…") and ask if it's right; then do the last name. If anything is wrong, ask the caller to spell it and read it back the same way. Do the same for email addresses. (Operator rule, 2026-11-16.)
- Ask one thing at a time. If they won't give a detail, carry on without it.
- Tell them the team will call back {{CALLBACK_PROMISE}}. Don't promise a specific person or time.
- If it sounds urgent (as defined in the emergency rules), follow the transfer rules instead of only taking a message.
```

## Extraction fields
`caller_name` (text), `callback_number` (text), `reason_for_call` (text), `urgency` (selector: low\|normal\|urgent), `is_new_customer` (boolean), `message_for_owner` (text), `follow_up_needed` (boolean), `is_spam` (boolean).

## Test cases
1. New lead. Pass if the agent collected name, number (read back), reason and best time, and save_caller_details was called.
   Also pass only if the agent spelled the name back letter by letter with a word per letter and waited for a yes; add a second case where the caller says the spelling is wrong, and pass only if the agent asks them to spell it.
2. A caller who won't give a name. Pass if the agent carried on politely and still recorded the reason.
3. A caller who gives a different callback number. Pass if the new number was read back and saved.
4. Notifier check (after deploying): send a signed sample `call_analyzed` payload to `/api/notify_owner`. Pass if it returns 2xx and the owner email arrives (use a test inbox).

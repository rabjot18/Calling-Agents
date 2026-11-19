# Retell: gotchas

Things the docs get wrong, leave ambiguous, or that surprised us. Newest first. Add to this file during every build.

## Verified by live API calls (2026-11-16)
- **The channel filter needs a `type` field.** The docs example `{"filter_criteria": {"channel": {"op": "eq", "value": "voice"}}}` returns 400 (`must have required property 'type'`). This works: `{"channel": {"type": "string", "op": "eq", "value": "voice"}}`.
- **The error body shape varies by status.** 400 validation errors return `{"error_message": "..."}`, while 404s return `{"status": "error", "message": "Not Found"}`. Read both fields.
- **CDN imports in the browser (found 2026-11-16):** jsdelivr `+esm` (and esm.sh) bundles import their dependencies with root-relative paths (`/npm/eventemitter3@…/+esm`). In a real browser these hit **our** origin and returned 404, so the SDK failed to load. Fix: `test_page.py` proxies versioned `/npm/*/+esm` paths from jsdelivr, and the page imports `/npm/retell-client-js-sdk@3.0.3/+esm` from its own origin. Verified in Chrome: `RetellWebClient` loads.
- **Simulation `current_time`:** passing `dynamic_variables: {"current_time": "…"}` on a test case does override the built-in, which made it possible to test after-hours behaviour (verified 2026-11-16).
- **A simulation can end in "error" rather than fail** ("Ending the conversation early as there might be a loop"). That's the simulated caller looping, not the agent; rerun before acting on it.
- **Browser web calls (SDK 3.x):** `RetellClient.createWebCall()` needs a **public key** (created in the dashboard, with domains allowed). To avoid that operator step, our test page creates the call server-side (`POST /v3/create-web-call` returns `call_id, access_token, transport: "gateway", ice_servers, expires_at`) and joins with the legacy-compatible `RetellWebClient.startCall({accessToken, callId, transport, iceServers})`. The SDK is pinned at 3.0.3 and served by jsdelivr `+esm`. v2 of the SDK and `/v2/create-web-call` were deprecated on 2026-10-18.
- **`GET /v2/list-test-case-definitions` needs `?type=retell-llm&llm_id=…`** (or `conversation-flow` + `conversation_flow_id`). Without it the call returns 400.
- **The legacy `POST /list-agents` returns 404.** Use `POST /v2/list-agents`.
- **Most list endpoints use `/v2/` or `/v3/` and return `{items, has_more}`**, but `GET /list-voices` and `GET /list-knowledge-bases` return bare arrays.
- **List endpoints mix methods:** agents and calls use POST (`/v2/list-agents`, `/v3/list-calls`). LLMs, flows and numbers use GET (`/v2/list-phone-numbers` accepts both).
- **The app templates include `monday`** (CRM, OAuth), which no docs page mentions.
- **A key test returning 400 says nothing about the key.** Only 401 means the key is bad.

## Found in the docs and spec (not yet exercised)
- **Integration tools can be added through the API.** The Cal.com deprecation notice says "adding the resulting tools to an agent is dashboard-only (as of August 2026)", but the current spec accepts `{type: "integration_app", app_id, provider, app_tool_template_name, parameters}` in `general_tools`. Trust the spec, and verify on the first build.
- **OAuth integrations can't be connected through the API.** `create-app` rejects `auth_config` for OAuth providers, so someone with the client's login has to connect them in the dashboard. Cal.com with an API key, Calendly, HubSpot, GoHighLevel and Notion work through the API.
- **Multi-prompt agents are being retired.** No new ones after 2026-12-15, and no edits after 2027-02-01. `update-retell-llm` already rejects adding the first state to a single-prompt LLM.
- **The built-in Cal.com tools are gone** (`check_availability_cal`, `book_appointment_cal`; the API stopped accepting them on 2026-09-30). Use the Cal.com integration.
- **Phone-number single-agent fields are deprecated** (`inbound_agent_id`, etc.) in favour of `inbound_agents: [{agent_id, agent_version, weight}]`, but the purchase-number page still mentions `inbound_agent_id`.
- **`update-retell-llm` replaces each top-level key entirely.** Sending `general_tools` overwrites the whole list.
- **`update-call` only works on ended calls** (since 2026-08-31). Use `update-live-call` for calls in progress.
- **Transfers:** these work on phone calls only, not web calls. Showing the caller's number to the destination requires carrier support, or the transfer fails. Telnyx supports it only on cold SIP REFER transfers, so prefer Twilio numbers.
- **Custom functions keep running when the caller interrupts.** Make any booking or charge endpoint idempotent. Retries (`max_retry`) repeat the request.
- **Simulation tests call real systems for any unmocked tool.** Transfers and SMS are always faked.
- **The `prod` and `staging` tag variables apply to live calls**, including when edited from the test panel.
- **SMS:** custom text needs A2P 10DLC registration on a Twilio number. Telnyx and Bandwidth numbers can't send SMS. Without registration, only Retell's preset template is available.
- **The agent never hangs up on its own** unless it has an `end_call` tool.
- **Newly bought numbers may have a 2-minute hold on outbound calls.** Some workspaces need KYC before any outbound call.
- **Testing is billed at production rates.** Buying a number needs a card on file even with free credit remaining.
- **Webhooks carry full raw call data** whatever the storage setting. With stricter settings, Retell deletes the recording about 10 minutes after `call_analyzed`.

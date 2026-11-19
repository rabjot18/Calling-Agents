# Retell: tools, integrations and webhooks

Last verified: 2026-11-16. Sources: https://docs.retellai.com/build/single-multi-prompt/function-calling, /custom-function, /integration-tools, /code-tool, /transfer-call, /send-sms, /integrations/overview, /integrations/cal-com-functions, /features/webhook-overview, /features/secure-webhook, /agent/agent-workflow, OpenAPI `Tool` schemas.

## Choosing a tool type
1. **Built-in tool:** end_call, transfer_call, agent_swap, send_sms, press_digit, extract_dynamic_variable. Use it whenever it fits.
2. **Integration tool** (`integration_app`): when the client uses a supported provider (Cal.com, Calendly, GoHighLevel, HubSpot, Salesforce, Zoho, Dynamics, monday, Zendesk). No server needed.
3. **Code tool** (`code`): self-contained logic, or a call to a public API with no secrets. JavaScript with `fetch()`, a 5–60 s timeout, running in Retell's sandbox.
4. **Custom function** (`custom`): anything else. We host an HTTPS endpoint.
5. **MCP** (`mcp`): a remote MCP server, if one already exists for the client's system.

Tools go in `general_tools` on the Retell LLM (or `tools` on a flow or subagent node). Pre-call and post-call tools go on the agent (`pre_session_tools`, `post_session_tools`).

## Built-in tool JSON (for `general_tools`)
```json
{"type": "end_call", "name": "end_call", "description": "End the call after saying goodbye."}

{"type": "transfer_call", "name": "transfer_to_owner",
 "description": "Transfer when the caller has an emergency or asks for a person.",
 "transfer_destination": {"type": "predefined", "number": "+15551234567"},
 "transfer_option": {"type": "warm_transfer", "private_handoff_option": {"type": "prompt", "prompt": "Brief the owner on who is calling and why."},
                     "on_hold_music": "ringtone", "transfer_ring_duration_ms": 25000},
 "speak_during_execution": true, "execution_message_description": "Tell the caller you're connecting them now."}

{"type": "extract_dynamic_variable", "name": "capture_caller", "description": "Save the caller's details once given.",
 "variables": [{"type": "string", "name": "caller_name", "description": "Caller's full name"}]}
```
- **Transfer types:** `cold_transfer` (+`cold_transfer_mode` sip_invite\|sip_refer), `warm_transfer` (human detection, whisper `private_handoff_option`, `public_handoff_option`), `agentic_warm_transfer` (needs a separate transfer agent created with `is_transfer_agent: true` and an LLM with `is_transfer_llm: true`).
- `transfer_destination` can be `{type: "inferred", prompt}`, letting the LLM choose from numbers listed in the prompt (e.g. for departments).
- The exact shape of `private_handoff_option` and `public_handoff_option` should be checked against the OpenAPI spec before first use **(inferred)**.

## Custom function contract
**Config:** `{type: "custom", name, description, url, method (default POST), parameters: {type: "object", properties, required}, headers, query_params, timeout_ms (1000–600000, default 120000), max_retry (0–5), args_at_root, response_variables: {var: "dot.path"}, execution_status_variable, speak_during_execution, execution_message_description, execution_message_type: "prompt"|"static_text", speak_after_execution, enable_typing_sound}`

**Request Retell sends (POST, PUT, PATCH):**
- Headers: `X-Retell-Signature`, `Content-Type: application/json`, plus any headers we configured (which can include `{{variables}}`).
- Body: `{"name": "<fn>", "call": {<call object: call_id, agent_id, from/to, metadata, dynamic variables, transcript so far>}, "args": {...}}`. With `args_at_root: true`, the body is just the args.
- GET and DELETE send no body, so the args become query parameters.
- Only properties with a `description` are filled in by the LLM. Properties with a `const` value are fixed.

**Response we return:** any 2xx. The body (string or JSON) is converted to a string and given to the LLM, **capped at 15,000 characters**. Only a JSON object can fill `response_variables`.

**Failure:** on timeout or a non-2xx response, the agent receives the error text and carries on. No retries unless `max_retry` > 0, and retries require an idempotent endpoint. **If the caller interrupts, the request is not cancelled**, so side effects (bookings) must be idempotent.

**Security:**
- Verify `X-Retell-Signature` (format `v={ms_timestamp},d={hex}`). `d = HMAC-SHA256(key=RETELL_API_KEY, msg=raw_body + timestamp)`. Reject if the timestamp is more than 5 minutes old. For GET and DELETE, use an empty body string.
- Optionally allow-list the source IP `100.20.5.228` (custom functions and webhooks). Code tool requests come from `35.166.138.221`.

**Restrictions:** the endpoint must be publicly reachable. localhost, private IPs and cloud metadata addresses are blocked.

**Latency:** turn on `speak_during_execution` for anything over about 1 s.

## Integration tools (`integration_app`)
1. Connect: `POST /create-app {type, provider, auth_config, tenant_url?, tenant_id?}`. This works for **API-key providers: Cal.com (api_key), Calendly, GoHighLevel, HubSpot, Notion**. OAuth providers (Salesforce, Zoho, Dynamics, Zendesk, Google Drive, OneDrive, monday, Cal.com OAuth) need a one-time **dashboard** sign-in by someone with the client's login.
2. Find the tool names: `GET /list-app-templates` gives `tools[].name`.
3. Attach: `{"type": "integration_app", "name": "check_availability", "app_id": "<app>", "provider": "calcom", "app_tool_template_name": "check_calcom_availability", "parameters": [...≤5, with const or description...], "response_variables": {...}, "execution_status_variable": "avail_status"}`.
   The **exact `parameters` (ToolParameter) shape** comes from `POST /get-app-tool-schema/{app_id}`. Read it before the first build **(not yet verified: needs a connected app)**.
4. **Cal.com:** each tool is pinned to one event type ID (a link ID also works) and a timezone. Book Appointment needs a slot returned by Check Availability (local datetime), plus the attendee fields the booking form requires. Cal.com covers availability, book, list (by attendee email), get, reschedule and cancel.
5. **Calendly:** availability, book, list, get and cancel. **No reschedule** (do cancel then rebook).
6. **GoHighLevel:** CRM and calendar in one (availability, book, reschedule, cancel, plus contacts and notes).
7. **Timeouts:** 3–14 s depending on the provider. On failure the agent carries on, so the prompt must say what to do if booking fails (take a message).
8. **Testing writes for real:** "Run a test" in the dashboard and unmocked simulation runs create real bookings.

## Pre-call and post-call workflow
- `pre_session_tools`: runs before the agent speaks, as a dependency graph (`depends_on`). Outputs become dynamic variables. Typical use: look up the caller in the CRM by `{{user_number}}`, then greet them by name.
- `post_session_tools`: runs after post-call analysis and can be gated on a condition. Can use app, custom, code or send_sms tools. Typical use: log the call to the CRM, create a task, text the owner a summary. The built-in variables `{{call_summary}}`, `{{call_successful}}` and `{{user_sentiment}}` are available here.

## Call event webhooks
- Agent-level `webhook_url`, which overrides the account-level webhook for that agent. `webhook_events` defaults to `call_started`, `call_ended`, `call_analyzed`. Optional: `transcript_updated`, `transfer_started`, `transfer_bridged`, `transfer_cancelled`, `transfer_ended`.
- Payload: `{event, call: <get-call object>}`. `call_analysis` arrives only with `call_analyzed`.
- 10 s timeout, retried up to 3 times. Return 2xx quickly. Deduplicate on `event` + `call_id`.
- The signature uses the same `X-Retell-Signature` HMAC as custom functions.
- Webhooks always carry full unscrubbed data. On stricter storage settings, Retell deletes the recording about 10 min after analysis, so download it promptly if needed.
- Webhook URLs can contain `{{variables}}`.

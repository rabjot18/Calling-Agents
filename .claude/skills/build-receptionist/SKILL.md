---
name: build-receptionist
description: Build, test, publish and deploy a client's AI receptionist on Retell end to end. It reads /docs and the client's research, assembles capability modules (the receptionist-* skills), uses native integrations first, deploys custom functions to Vercel only when nothing native exists, picks the newest fast model from live benchmark data, creates and publishes the agent, attaches a phone number, and saves everything to the client's folder. Use after research-business has run (CLAUDE.md workflow steps 4–6), and again to update an existing client's build.
---

# Build a receptionist

The work runs in order. Every artifact goes in `clients/<slug>/`. Secrets go only in `.env` files.

## 1. Read first (no building until done)
- `docs/retell/README.md`, `capabilities.md`, `tools-and-integrations.md`, `custom-functions.md` and `gotchas.md`.
- Run `research-platform` step 0 (the fingerprint check). If Retell's docs changed, update `docs/retell/` before building.
- `docs/business-types/<type>.md` and, in the client folder: `brief.md`, `research.md`, `call-flow.md`, `prompt.md`, `functions.md`, `questions.md` and the owner's answers. If `research-business` hasn't run, run it first.
- `docs/vercel.md` if any custom function might be needed.
- **If `clients/<slug>/config/ids.json` exists, this is an update.** Use update endpoints and new agent versions, and never create duplicates.

## 2. Choose the modules
From `call-flow.md`, choose which library skills apply and load each one. Every build includes **lead-capture** (message taking plus owner notification) and **transfer**. Add the others as needed:

| Module skill | Include when |
|---|---|
| `receptionist-faq` | Always (hours, location, services, prices) |
| `receptionist-lead-capture` | Always (taking messages, new-customer leads, the post-call owner notification) |
| `receptionist-transfer` | Always (emergencies, a request for a human, the overflow fallback) |
| `receptionist-booking` | The business takes appointments |
| `receptionist-cancel-reschedule` | Booking is included and the system supports changes |
| `receptionist-after-hours` | The business has hours (nearly always) |

Each module gives you a prompt section, tool configs (native first), extraction fields, test cases, and the owner facts it needs.

## 3. Pick the model (never default to an older model)
```bash
python3 -I .claude/skills/build-receptionist/scripts/retell_models.py --md clients/<slug>/config/model-check.md
```
- The script joins Retell's accepted model list (OpenAPI) with Retell's live benchmark (p50 latency, cost, tool-calling accuracy). It picks the **newest-generation, lowest-latency** model with tool-calling ≥ 0.93, excluding beta and low-sample models. It also picks a fast-fallback backup.
- Use its JSON output as `model_config: {"type": "cascading", "primary": {...}, "backup": {...}, "temperature": 0}`.
- If the script fails (a page changed), fix the script; don't guess. Check retellai.com/pricing for "Recommended" labels as a sanity check.
- Copy the table to `docs/retell/models.md` when it changes.

## 4. Native integrations first
For every tool in `functions.md`, choose in this order, and record the choice and reason in `functions.md`:
1. **A Retell built-in tool** (end_call, transfer_call, send_sms, extract_dynamic_variable, agent_swap).
2. **A Retell integration** (`integration_app`). Use `GET /list-app-templates` for the current providers and tool names.
   - API-key providers (Cal.com, Calendly, GoHighLevel, HubSpot, Notion): `POST /create-app` with the client's key from `clients/<slug>/.env`. Then `POST /test-app-auth/{id}`, then read `POST /get-app-tool-schema/{app_id}` to get the exact parameters.
   - OAuth providers (Salesforce, Zoho, Dynamics, Zendesk, monday, Google Drive, OneDrive): can't be done through the API. Add an operator walkthrough (step 10), carry on with everything else, and attach the tool once it's connected (`GET /list-apps` shows it).
3. **A knowledge base** for static information (`POST /create-knowledge-base`, multipart).
4. **A code tool** (`type: "code"`) for self-contained logic or public APIs, with no secrets.
5. **A custom function on Vercel**, and only if 1–4 can't do it (step 6).

## 5. Secrets
- Client credentials (CRM or calendar keys the owner provides) go in `clients/<slug>/.env`. Platform keys go in the root `.env`.
- **Vercel:** if a custom function is needed and the root `.env` has no `VERCEL_TOKEN`, ask the operator **once**, using the walkthrough in `docs/vercel.md`. Save the token as `VERCEL_TOKEN=` in the root `.env` (and `VERCEL_TEAM_ID` if it's a team token). Never ask again, and never print it.
- Never write a secret into config JSON, prompts, reports, or tool headers. Tool headers reference variables instead.

## 6. Custom functions (only when step 4 has no option)
1. Copy `.claude/skills/build-receptionist/templates/vercel/` to `clients/<slug>/functions/`. Each tool becomes `api/<tool_name>.js`:
   ```js
   import { tool } from "../lib/retell.js";
   export const POST = tool(async (args, call) => { /* … */ return { ok: true, message: "…what the agent should say…" }; });
   ```
   Always return a short, speakable result. On any failure, return `{ok: false, message: "...take a message instead"}`; never throw at Retell.
2. Make actions idempotent (key them on `call.call_id` plus the args), because Retell doesn't cancel requests when a caller interrupts.
3. Deploy:
   ```bash
   set -a; source .env; [ -f clients/<slug>/.env ] && source clients/<slug>/.env; set +a
   python3 -I .claude/skills/build-receptionist/scripts/deploy_vercel.py clients/<slug>/functions rcpt-<slug> --env RETELL_API_KEY [--env CLIENT_SECRET …]
   ```
4. Save the printed URL to `config/ids.json`. Point each custom tool at `<url>/api/<tool_name>` with `"method": "POST"`, a `timeout_ms` suited to the backend (usually 8000–15000), `speak_during_execution: true`, and `max_retry: 0` unless the endpoint is idempotent.
5. Test each endpoint once with a signed request (sign it with HMAC exactly as `lib/retell.js` verifies it) before wiring it into the agent.
6. Record any new findings in `docs/vercel.md`.

## 7. Create the agent
1. **Prompt:** assemble `prompt.md` from the research draft plus each module's prompt section. Fill in owner answers, and turn any unanswered `{{OWNER: …}}` into the module's documented default, logging it as an assumption. Keep it concise.
2. **Knowledge base** if needed (from the FAQ module).
3. **LLM:** `POST /create-retell-llm` (on rebuilds, `PATCH /update-retell-llm/{id}` with the **full** `general_tools` array) with `start_speaker: "agent"`, `begin_message`, `general_prompt`, `general_tools`, `model_config` (step 3), `knowledge_base_ids` and `default_dynamic_variables`. Save the exact payload to `config/llm.json`.
4. **Agent:** `POST /create-agent` (or `PATCH /update-agent/{id}`). Save the payload to `config/agent.json`. Defaults:
   - **Voice:** a `retell-*` platform voice matching the brand tone. Check it exists in `GET /list-voices`. Platform voices are the cheapest and support expressive mode.
   - **Language, timezone:** `language` (the client's locale) and `timezone` (the client's IANA zone). Both are required for after-hours logic.
   - **Transcription:** `boosted_keywords` (business name, staff, services, streets). Use `vocab_specialization: "medical"` for health businesses.
   - **Call limits:** `end_call_after_silence_ms: 30000`, `max_call_duration_ms: 900000`.
   - **Extraction:** `post_call_analysis_data` (the union of the modules' fields).
   - **Webhooks:** `webhook_url` (the lead-capture notifier, if custom) and `webhook_events: ["call_analyzed"]`.
   - **Data:** `data_storage_setting` (`everything_except_pii` plus `pii_config` for health or legal clients, `everything` otherwise) and `data_storage_retention_days: 365`.
   - **Do-not-call:** `enable_dnc_detection: true`.
   - **Pre/post-call tools:** `pre_session_tools` and `post_session_tools` from the modules (CRM lookup and logging).
5. Save every ID to `config/ids.json`. `validate-receptionist` reads these exact keys: `agent_id`, `llm_id` (or `conversation_flow_id`), `published_version`, `phone_number`, `app_ids` (list), `kb_ids` (list), `vercel_url` and `test_case_ids` (list, filled in step 8).

## 8. Test before publishing
- Convert the modules' test cases plus `tests/cases.md` into Retell test cases (see `docs/retell/testing.md`). **Mock every custom, integration and code tool.**
- Run a batch and poll until it completes. Fix the prompt or tools, then rerun, until **every case passes at least 2 of 3 runs**.
- Write the results to `tests/results.md` (pass counts, failures, and the fixes made). Note what the tests cost.

## 9. Publish and attach a number
1. `POST /publish-agent-version/{agent_id}`, then record the published version number in `ids.json`.
2. **Number:** if `ids.json` already has one, `PATCH /update-phone-number/{e164}` to point it at the new version. Otherwise `POST /create-phone-number` with:
   - `area_code` from the client's own number (if it's unavailable, try neighbouring codes) and `country_code`.
   - `number_provider: "twilio"`.
   - `inbound_agents: [{agent_id, agent_version: <published number>, weight: 1}]`.
   - `fallback_number`: the transfer target or owner's line.
   - `nickname: <slug>`.

   Pin the published version so later draft edits never reach callers.
3. If the purchase fails because there's no payment method, add a walkthrough and finish everything else.
4. **Live check:** `GET /get-phone-number/{e164}` must show the binding. Ask the operator to make one real call, or place one to the operator's phone with `POST /v2/create-phone-call` if they've given a number. Then `GET /v2/get-call/{id}` and check the transcript, latency (`latency.llm.p50`) and that the tools were called.
5. Save the payload and number to `config/phone-number.json` and `ids.json`.

## 10. Operator steps (walkthroughs)
Whenever anything can't be finished without the operator, give a walkthrough in plain English, TL;DR-sized. The usual cases are a dashboard OAuth sign-in, a payment method, a BAA signature, call forwarding at the carrier, A2P SMS registration, a missing token, or an owner-only login.

Format:
```
**You need to: <outcome>** (~N min)
1. <one short instruction, exact button names>
2. …
Then tell me "<trigger phrase>" and I'll <what happens next>.
```
Five steps at most, with no jargon or explanation beyond what's needed to click through. Put each one in `REPORT.md` and in the final message.

The standard go-live walkthrough for the owner is: "Forward your business line to <number>." Give carrier-generic steps: dial `*72` plus the number, or use the carrier's app or portal. For "answer first, then AI", use busy/no-answer forwarding (often `*92` or `*71`; check with the carrier).

## 11. Save and report
`clients/<slug>/` must contain:
- `brief.md`, `research.md`, `call-flow.md`, `prompt.md`, `functions.md`, `questions.md`
- `config/` (`ids.json`, `llm.json`, `agent.json`, `phone-number.json`, `model-check.md`)
- `functions/` (if any)
- `tests/` (`cases.md`, `results.md`)
- `REPORT.md`

`REPORT.md` follows CLAUDE.md rule 6: **Built** (number, agent and version, model, tools marked native or custom, test pass rate, live-call result), **Assumed**, **Couldn't do**, then **Your steps** (the walkthroughs). Update `docs/retell/gotchas.md` and `docs/vercel.md` with anything learned.

## 12. Hand off to validation
Always finish by running `validate-receptionist`. A build isn't done until it has passed validation, or until its failures are listed under **Couldn't do**.

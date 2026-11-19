# Retell AI: platform knowledge

Last verified: 2026-11-16
Docs index: https://docs.retellai.com/llms.txt
Docs fingerprint: sha256:ac01e040e59c14b65e8fae856292fe135c9d55ce8f65eca640eac1ce16a92ce6
OpenAPI spec: https://docs.retellai.com/openapi.yaml (113 endpoints)

Retell is our voice platform. It hosts the whole receptionist: speech-to-text, the LLM, text-to-speech, telephony (US/CA numbers it sells, or a SIP trunk you bring), tools, transfers, SMS, post-call extraction, simulation testing and webhooks. We build everything through its REST API (CLAUDE.md rule 7).

## Basics
- **Base URL:** `https://api.retellai.com`
- **Auth:** `Authorization: Bearer $RETELL_API_KEY`. The key lives in the root `.env`.
- **Body:** JSON. Send `Content-Type: application/json` on POST, PATCH and PUT. Knowledge-base creation is multipart.
- **Errors:** `{"error_message": "..."}` with 400/401/404/429/500 (verified 2026-11-16). The docs claim `{status, message}`.
- **Account (verified 2026-11-16):** concurrency limit 20 (base, the free allowance), burst enabled up to 60 (burst minutes cost +$0.10/min), up to 180 more slots purchasable. The account starts empty: no agents, LLMs, flows, numbers, knowledge bases or integration connections.

## Key test
```bash
set -a; source .env; set +a
curl -sS -o /dev/null -w '%{http_code}\n' -X POST 'https://api.retellai.com/v2/list-agents?limit=1' \
  -H "Authorization: Bearer $RETELL_API_KEY" -H 'Content-Type: application/json' --data '{}'
```
`200` means the key is valid. `401` means it's bad or inactive. `400` means a malformed request and says nothing about the key. `GET /get-api-key-info` also works and returns the org name and key name.

## MCP server (connected 2026-11-16)
- **URL:** `https://mcp.retellai.com` (Streamable HTTP), with the header `Authorization: Bearer <RETELL_API_KEY>`. It's registered in Claude Code at **local scope** as `retell`, stored in `~/.claude.json` for this project only, not in the repo.
- **Tools:** only three. `list_api_endpoints` (optional `search`), `get_api_endpoint_schema` (e.g. `updateAgent`) and `invoke_api_endpoint`, which validates arguments against the schema and then calls the API. Deprecated endpoints aren't exposed, and unknown arguments are rejected before any API call.
- **Use it for:** interactive lookups and debugging. Builds and validation stay on the REST scripts so their payloads are saved. `invoke_api_endpoint` can do anything the key can, so never auto-approve it.
- **Reconnect** after a key change: `claude mcp remove retell -s local`, then add it again (CLAUDE.md rule 7.5).
- An alternative is Retell's Claude connector (`/get-started/claude`), which uses your Retell login instead of a key. We don't use it.

Source: https://docs.retellai.com/get-started/mcp-server

## Object model
```
Phone number ──inbound_agents[{agent_id, agent_version, weight}]──▶ Agent (voice settings, webhook, analysis, timezone…)
                                                                      │ response_engine
                                                                      ▼
                                   Retell LLM (single prompt + general_tools)   ← default for receptionists
                                   or Conversation Flow (nodes + edges + tools)
                                   or Custom LLM (our own websocket; avoid)
Retell LLM / Flow ──knowledge_base_ids──▶ Knowledge Base (URLs, text, files)
Tools live on the LLM (general_tools) or flow; pre/post-call tools live on the Agent.
Integration tools (type integration_app) point at an App = a workspace connection to Cal.com, HubSpot, etc.
Calls are created by inbound traffic, POST /v2/create-phone-call, or POST /v3/create-web-call.
```
- **Agent versions:** a new version starts as a draft. Publishing makes it read-only. Phone numbers can point at a numeric version, `"latest"`, or an environment tag (`prod`, `staging`). Tags carry their own dynamic-variable values, which apply to live calls.
- **Agent type:** use a **single prompt** (Retell LLM) by default. Retell itself recommends starting there. Switch to a conversation flow only when the prompt gets too long or a strict order is required (for compliance). **Multi-prompt is deprecated:** creation ends 2026-12-15 and editing ends 2027-02-01. Never create `states`.

## Receptionist build recipe (API only)
1. **Knowledge** (optional): `POST /create-knowledge-base` (multipart: `knowledge_base_name`, `knowledge_base_texts`, `knowledge_base_urls`, `knowledge_base_files`). Then poll `GET /get-knowledge-base/{id}` until it's ready.
2. **Integrations** (if the client uses Cal.com, Calendly, GoHighLevel, HubSpot, etc.): `POST /create-app` with `type`, `provider` and `auth_config` (API-key providers only). OAuth providers must be connected in the dashboard (see gotchas.md).
3. **LLM:** `POST /create-retell-llm` with `start_speaker: "agent"`, `begin_message`, `general_prompt`, `model_config: {type: "cascading", primary: {model, tier}}`, `general_tools` (end_call, transfer_call, send_sms, custom, integration_app…), `knowledge_base_ids` and `default_dynamic_variables`.
4. **Agent:** `POST /create-agent` with `response_engine: {type: "retell-llm", llm_id}`, `voice_id`, `agent_name`, `language`, `timezone`, `webhook_url`, `post_call_analysis_data`, `boosted_keywords` (business names, staff, streets), `data_storage_setting`, `max_call_duration_ms`, `end_call_after_silence_ms`, and `pre_session_tools`/`post_session_tools` if needed.
5. **Test** (see testing.md): run simulation test cases with `POST /create-test-case-definition` and `POST /create-batch-test` (mock every tool that touches real systems), then poll `GET /get-batch-test/{id}`.
6. **Publish:** `POST /publish-agent-version/{agent_id}`.
7. **Number:** `POST /create-phone-number` with `area_code`, `country_code`, `number_provider: "twilio"`, `inbound_agents: [{agent_id, agent_version, weight: 1}]`, `fallback_number` (the owner's line) and `nickname`. Or `POST /import-phone-number` for a number the client already has (see phone-numbers.md). This costs money, so get the operator's approval first.
8. **Live check:** call the number from a real phone, or place an outbound call to the operator with `POST /v2/create-phone-call` (from our Retell number; KYC may be needed). Then read the call with `GET /v2/get-call/{call_id}`.
9. **Go live:** the client forwards their existing business line to the Retell number (carrier call forwarding), or ports or imports their number.

## Files
| File | What's in it |
|---|---|
| [capabilities.md](capabilities.md) | Everything Retell does natively, and its limits |
| [api.md](api.md) | Every endpoint, grouped by object |
| [phone-numbers.md](phone-numbers.md) | Buy, import, bind, fallback, SIP, SMS, costs |
| [tools-and-integrations.md](tools-and-integrations.md) | Tool types, the custom-function contract, integrations, webhooks |
| [testing.md](testing.md) | Simulation, batch, web and phone testing, with costs |
| [custom-functions.md](custom-functions.md) | Receptionist needs Retell can't meet natively, and what to build |
| [gotchas.md](gotchas.md) | Where the docs are wrong or surprising, and live-call findings |
| [models.md](models.md) | Latest model check: accepted models × benchmark latency, cost and tool accuracy, with the pick (regenerated by `build-receptionist/scripts/retell_models.py`) |
| [_index.txt](_index.txt) | Docs page list at the fingerprint above (for diffing on re-runs) |

## Pricing (as of 2026-11-16)
- **Agent:** about $0.11/min (voice infrastructure $0.055, GPT-5.1 standard $0.04, platform voice $0.015). The full range is about $0.07–$0.31/min depending on model and voice.
- **Telephony:** about $0.015/min on Retell numbers. Toll-free inbound costs $0.06/min.
- **Numbers:** $2/mo, or $5/mo toll-free.
- **Testing:** billed at production rates. Text simulation costs about $0.001–$0.05 per message. AI QA is free for the first 100 minutes, then $0.10/min.
- **Free tier:** $10 credit at signup and 20 concurrent calls. Buying a number requires a card on file.

Sources: https://docs.retellai.com/accounts/billing, /deploy/purchase-number, /test/testing-pricing, /deploy/concurrency

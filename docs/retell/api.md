# Retell: API endpoints

Last verified: 2026-11-16 against https://docs.retellai.com/openapi.yaml. Base URL `https://api.retellai.com`, Bearer auth.

- **Pagination:** list endpoints return `{items, has_more, pagination_key}`. Pass `pagination_key` back to get the next page. Query parameters: `limit` (≤1000), `sort_order`. **Exceptions:** `GET /list-voices` and `GET /list-knowledge-bases` return bare arrays (verified).
- **Errors:** `{"error_message": "..."}`. A 429 means a rate limit or knowledge-base quota.
- Read-only calls marked ✅ were verified live on 2026-11-16.

## Agents (voice)
| Method | Path | Purpose / key fields |
|---|---|---|
| POST | `/create-agent` | **Required:** `response_engine`, `voice_id`. See capabilities.md for the other fields. `is_transfer_agent` can only be set at creation. |
| GET | `/get-agent/{agent_id}` | Optional `?version=`. |
| POST | `/v2/list-agents` ✅ | Body: `filter_criteria` (`channel` **needs `type`**, see gotchas.md), `query`, `is_transfer_agent`. |
| PATCH | `/update-agent/{agent_id}` | Updates the draft. |
| DELETE | `/delete-agent/{agent_id}` | |
| POST | `/create-agent-version/{agent_id}` | New draft from a version. |
| POST | `/publish-agent-version/{agent_id}` | Publishes the draft (makes it read-only). |
| DELETE | `/delete-agent-version/{agent_id}` | |
| GET | `/list-agent-versions/{agent_id}` | |
| POST | `/repair-agent/{agent_id}` | Not described in the docs. |
| GET | `/get-mcp-tools/{agent_id}` | Lists the tools of attached MCP servers. |

## Response engines
| Method | Path | Purpose / key fields |
|---|---|---|
| POST | `/create-retell-llm` | `start_speaker` (required in practice), `begin_message`, `general_prompt`, `general_tools`, `model_config`, `knowledge_base_ids`, `kb_config`, `default_dynamic_variables`, `mcps`, `is_transfer_llm`. **Never set `states`** (deprecated). |
| GET | `/get-retell-llm/{llm_id}` · `/v2/list-retell-llms` ✅ | |
| PATCH | `/update-retell-llm/{llm_id}` | Each top-level key replaces the stored value entirely (e.g. you must send the whole `general_tools` array). |
| DELETE | `/delete-retell-llm/{llm_id}` | |
| POST | `/create-conversation-flow` · PATCH `/update-conversation-flow/{id}` · GET `/get-conversation-flow/{id}` · GET `/v2/list-conversation-flows` ✅ · DELETE `/delete-conversation-flow/{id}` | Nodes, edges, tools, `is_transfer_cf`. |
| * | `/create-conversation-flow-component`, `/get-…`, `/v2/list-conversation-flow-components`, `/update-…`, `/delete-…` | Reusable subflows. |

`response_engine` shapes: `{type: "retell-llm", llm_id, version?}` · `{type: "conversation-flow", conversation_flow_id, version?}` · `{type: "custom-llm", llm_websocket_url}`.

## Calls
| Method | Path | Purpose / key fields |
|---|---|---|
| POST | `/v2/create-phone-call` | Outbound call: `from_number` (our Retell number), `to_number`, `override_agent_id`, `retell_llm_dynamic_variables`, `metadata`. |
| POST | `/v3/create-web-call` | **Required:** `agent_id`; also `agent_version`, `agent_override`, `retell_llm_dynamic_variables`, `metadata`. Returns an access token for a browser client. |
| POST | `/v2/register-phone-call` | For custom telephony that dials Retell's SIP endpoint. |
| GET | `/v2/get-call/{call_id}` | Transcript, `recording_url`, `call_analysis`, `call_cost`, `disconnection_reason`, latency. |
| POST | `/v3/list-calls` ✅ | Body filters. |
| PATCH | `/v2/update-call/{call_id}` | Ended calls only (since 2026-08-31): metadata and data-storage changes. |
| PATCH | `/v2/update-live-call/{call_id}` | Changes a call in progress. |
| POST | `/v2/stop-call/{call_id}` · `/v2/listen-live-call/{id}` · `/v2/take-over-live-call/{id}` | |
| DELETE | `/v2/delete-call/{call_id}` | |
| PUT | `/rerun-call-analysis/{call_id}` | |
| POST | `/create-batch-call` | Outbound campaigns (not needed for receptionists). |
| GET | `/v2/list-export-requests` | |

## Phone numbers
| Method | Path | Purpose / key fields |
|---|---|---|
| POST | `/create-phone-number` | **Buys a number ($).** `area_code` (US 3-digit), `country_code` US\|CA, `number_provider` twilio\|telnyx\|bandwidth, `toll_free`, `phone_number` (a specific number), `inbound_agents`, `outbound_agents`, `nickname`, `inbound_webhook_url`, `fallback_number`, `allowed_inbound_country_list`. |
| POST | `/import-phone-number` | Brings our own SIP-trunk number. **Required:** `phone_number`, `termination_uri`; also `sip_trunk_auth_username/password`, `inbound_agents`, `transport`. |
| GET | `/get-phone-number/{e164}` · `/v2/list-phone-numbers` ✅ (GET and POST) | |
| PATCH | `/update-phone-number/{e164}` | `inbound_agents`, `outbound_agents`, `inbound_sms_agents`, `outbound_sms_agents`, `inbound_webhook_url`, `inbound_sms_webhook_url`, `fallback_number`, `inbound_fallback_enabled` (Backup mode). |
| DELETE | `/delete-phone-number/{e164}` | Releases the number and stops billing. |

`inbound_agents` items are `{agent_id, agent_version: 3 | "latest" | "prod", weight}`, with weights summing to 1. The old `inbound_agent_id` field is deprecated.

## Knowledge bases
| Method | Path | Notes |
|---|---|---|
| POST | `/create-knowledge-base` | **multipart/form-data**: `knowledge_base_name`, `knowledge_base_texts` (JSON `[{title, text}]`), `knowledge_base_urls`, `knowledge_base_files`, `enable_auto_refresh`. |
| POST | `/add-knowledge-base-sources/{id}` · DELETE `/delete-knowledge-base-source/{id}/source/{source_id}` · POST `/refresh-knowledge-base/{id}` | |
| GET | `/get-knowledge-base/{id}` · `/list-knowledge-bases` ✅ (bare array) | `get` shows status and the remaining quota. |
| DELETE | `/delete-knowledge-base/{id}` | |

## Voices
GET `/list-voices` ✅ (bare array, 349 voices) · GET `/get-voice/{id}` · POST `/clone-voice` · POST `/search-community-voice` · POST `/add-community-voice`.

## Integrations ("Apps")
| Method | Path | Notes |
|---|---|---|
| GET | `/list-app-templates` ✅ | Providers plus each one's tool catalogue (`tools[].name` = `app_tool_template_name`) and auth types. |
| POST | `/create-app` | **Required:** `type` (crm\|calendar\|knowledge_base\|support\|communication), `provider`; also `auth_config`, `tenant_url`, `tenant_id`, `name`. OAuth providers reject `auth_config` and must be connected in the dashboard. |
| GET | `/get-app/{id}` · `/list-apps` ✅ · `/list-app-usages/{id}` | |
| PATCH/DELETE | `/update-app/{id}` · `/delete-app/{id}` | |
| POST | `/test-app-auth/{id}` | Checks the credentials. |
| POST | `/get-app-tool-schema/{app_id}` | A tool's input and response schema (used for `output_selection`). |
| * | `/get-crm-config`, `/update-crm-config`, `/get-crm-schema`, `/run-sync-job`, `/get-sync-job-status`, `/backfill-contact-analysis-data` | CRM contact sync. |

## Testing
| Method | Path | Notes |
|---|---|---|
| POST | `/create-test-case-definition` | **Required:** `name`, `response_engine`, `user_prompt`, `metrics` (success criteria, as strings); also `dynamic_variables`, `tool_mocks`, `llm_model` (for the simulated user). |
| GET/PUT/DELETE | `/get-test-case-definition/{id}`, `/update-…`, `/delete-…` | |
| GET | `/v2/list-test-case-definitions?type=retell-llm&llm_id=…` | **The `type` query parameter is required** (400 without it). Use `conversation_flow_id` for flows. |
| POST | `/create-batch-test` | **Required:** `test_case_definition_ids`, `response_engine`. Returns a batch ID with `status: in_progress`. |
| GET | `/get-batch-test/{id}` | Poll until `status: complete`, then read `pass_count`, `fail_count`, `error_count`, `total_count`. |
| GET | `/v2/list-test-runs/{batch_id}` · `/get-test-run/{run_id}` | Transcript and pass/fail explanation for each run. |
| POST | `/agent-playground-completion/{agent_id}` | A single text turn against the agent. |

## Chat / SMS (rarely needed for receptionists)
`/create-chat-agent` and related endpoints, `/create-chat`, `/create-sms-chat` (outbound SMS), `/create-chat-completion`, `/v3/list-chats`, `/end-chat`.

## Contacts
`/create-contact`, `/get-contact/{id}`, `/get-contact-by-phone/{e164}`, `/list-contacts` (POST), `/update-contact`, `/delete-contact`, `/list-contact-conversations/{id}`, `/create-contact-import`.

## Account
GET `/get-api-key-info` ✅ (org_id, org_name, api_key_name) · GET `/get-concurrency` ✅.

## Removed endpoints (don't use)
`POST /list-agents` (no v2) returns **404** (verified). The legacy get-agent-versions and v1 list endpoints have also been removed.

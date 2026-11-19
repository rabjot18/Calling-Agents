# Retell: native capabilities

Last verified: 2026-11-16. "Field" means the API field. LLM-level fields are on `create-retell-llm` and agent-level fields on `create-agent`.

## Conversation and voice
| Capability | Field / how | Limits & notes |
|---|---|---|
| Single-prompt agent | Retell LLM `general_prompt` + `general_tools` | Recommended default. Keep the prompt short; Retell advises against long lists of "do not" rules. |
| Conversation flow | `create-conversation-flow` (nodes: conversation, subagent, function, transfer, SMS, logic split, extract-DV, end, global, MCP, code) | Use for strict order or compliance. Supports reusable subflows (`create-conversation-flow-component`). |
| Multi-prompt (states) | Retell LLM `states` | **Deprecated.** Creation ends 2026-12-15. Don't use. |
| Model choice | `model_config: {type: "cascading", primary: {model, tier: standard\|fast\|ultrafast}, backup: {model, tier, kick_in_timeout_ms}, temperature}` | Models include gpt-4.1, gpt-5.x, gpt-5.6-terra/luna, gpt-6-astra/sol, gpt-6.1-sol/terra and others; get the list from the OpenAPI `CascadingModelConfig`. Temperature defaults to 0 (good for tool use). The fast fallback model can bill both models. Speech-to-speech and duplex types also exist. |
| Opening line | `start_speaker: "agent"`, `begin_message` | `begin_message: ""` makes the agent wait for the caller. `begin_message_delay_ms` can be 0–5000. |
| Voices | `voice_id` (349 voices: cartesia 88, elevenlabs 64, openai 55, minimax 39, inworld 29, xai 28, fish_audio 25, platform 21, e.g. `retell-Chloe`); `voice_model`, `voice_speed` 0.5–2, `voice_temperature` 0–2, `volume` 0–2, `fallback_voice_ids` | `GET /list-voices` (verified). Clone voices with `POST /clone-voice`. Platform voices are the cheapest ($0.015/min). |
| Expressive speech | `enable_expressive_mode`, `expressive_emotion_tags` | Platform voices only. |
| Pronunciation | `pronunciation_dictionary` | Provider-dependent. |
| Transcription bias | `boosted_keywords` | Use it for business names, staff names and street names. |
| Speech-to-text tuning | `stt_mode` fast\|accurate\|custom, `vocab_specialization` general\|**medical**, `denoising_mode` (noise / background-speech cancellation) | Use `medical` vocabulary for clinics (English only). |
| Turn-taking | `responsiveness` 0–1, `interruption_sensitivity` 0–1, `enable_backchannel`, `enable_dynamic_responsiveness` | |
| Silence handling | `reminder_trigger_ms`, `reminder_max_count`, `end_call_after_silence_ms` (min 10 s, default 10 min) | |
| Max call length | `max_call_duration_ms` 1 min–2 h | |
| Languages | `language`: one locale or an array (multilingual) | The multilingual setting requires a locale array (since 2026-07-31). |
| Timezone | agent `timezone` (IANA, default America/Los_Angeles) | Drives `{{current_time}}` and `{{current_calendar}}` (a 14-day calendar). |
| Dynamic variables | `{{var}}` in prompt and tools. `default_dynamic_variables`. Built-ins: `user_number`, `agent_number`, `direction`, `call_id`, `current_time`, `current_calendar`, `current_hour`, `session_duration` | Set per call through the inbound webhook, `create-phone-call` or `create-web-call`. |
| Guardrails | agent `guardrail_config` | Blocks prohibited topics in input and output. |
| Handbook presets | agent `handbook_config` | Toggles behaviour presets. |
| Call screening | agent `call_screening_option` | Handles "who's calling?" prompts (mainly for outbound calls). |
| Voicemail / IVR detection | `voicemail_option`, `ivr_option` | Mainly for outbound calls. |
| Caller keypad presses (DTMF) | `allow_user_dtmf` (default true), `user_dtmf_options` | Lets callers enter numbers on the keypad. |
| Do-not-call requests | `enable_dnc_detection` | Confirms the request, then ends the call. |

## Call control
| Capability | Field / how | Limits & notes |
|---|---|---|
| End call | tool `{type: "end_call"}` | The agent never hangs up on its own unless this tool is added. |
| Transfer to a human | tool `transfer_call`, `transfer_destination`: `{type: "predefined", number, extension}` or `{type: "inferred", prompt}`. `transfer_option`: `cold_transfer` (sip_invite\|sip_refer), `warm_transfer` (whisper/public handoff, human detection, hold music), `agentic_warm_transfer` (an AI screens the human first) | Phone calls only (not web calls). `show_transferee_as_caller` shows the caller's number to the destination; it needs carrier support or the transfer **fails**. Per-transfer `transfer_ring_duration_ms`. |
| Transfer to another AI agent | tool `agent_swap` | Same call with the history kept; lower latency than a phone transfer. |
| Overflow / backup | phone number `fallback_number`, dashboard "Backup mode" | When concurrency is exhausted (about 40 s), the call goes to the fallback number, or ends with `concurrency_limit_reached` if none is set. |
| Press keypad digits (DTMF) | tool `press_digit` | For navigating someone else's phone menu (outbound calls). |
| Stop a live call | `POST /v2/stop-call/{id}` | |
| Live listen / take over | `POST /v2/listen-live-call/{id}`, `/v2/take-over-live-call/{id}` | |

## Tools and functions
| Capability | Field | Limits & notes |
|---|---|---|
| Custom function (our HTTP endpoint) | `{type: "custom", name, url, method, description, parameters (JSON Schema), headers, query_params, timeout_ms, max_retry, args_at_root, response_variables, execution_status_variable, speak_during_execution, speak_after_execution}` | See tools-and-integrations.md for the contract. Timeout 1–600 s (default 120 s). Results are capped at 15,000 characters. The endpoint must be public. |
| Code tool (JavaScript in Retell's sandbox) | `{type: "code"}` | `fetch()` is available. Timeout 5–60 s (default 30 s). Requests come from 35.166.138.221. No server needed. |
| Extract a variable mid-call | `{type: "extract_dynamic_variable", variables}` | Captures caller details as typed variables. |
| Integration tool | `{type: "integration_app", app_id, provider, app_tool_template_name, parameters (≤5), response_variables}` | See tools-and-integrations.md. Times out after 3–14 s depending on the provider. |
| MCP tools | LLM `mcps`; tool `{type: "mcp"}` | Connects a remote MCP server. |
| Pre-call / post-call tools | agent `pre_session_tools` / `post_session_tools` (app, custom or code; post also supports send_sms), run as a `depends_on` graph | Pre-call runs before the first word and injects variables (e.g. a CRM lookup). Post-call runs after analysis (e.g. log to the CRM, text a summary). Post-call can be gated on a condition. |
| Send SMS mid-call | `{type: "send_sms", sms_content, sms_sender, sms_destination}` | Needs an SMS-enabled number (A2P 10DLC), **or** Retell's SMS-approved pool (preset template only, text not editable). Twilio numbers only; Telnyx and Bandwidth have no SMS. |

## Knowledge
| Capability | Field | Limits |
|---|---|---|
| Knowledge base (retrieval) | `POST /create-knowledge-base` (multipart); LLM `knowledge_base_ids`, `kb_config` | Per knowledge base: 500 URLs, 50 text snippets, 25 files (≤50 MB each; spreadsheets ≤1,000 rows × 50 columns). Auto-refresh and auto-crawl every 24 h. Source-addition quotas run on a rolling 30-day window; going over returns a 429 for the whole request. |
| Synced sources | Google Drive, OneDrive, Notion connections | Re-synced every 24 h. |

## Integrations (native, no server of our own)
| Provider | Type | Auth | Tools |
|---|---|---|---|
| Cal.com | calendar | api_key or OAuth | check_calcom_availability, book_calcom_appointment, list/get/reschedule/cancel bookings |
| Calendly | calendar | api_key | check_calendly_availability, book_calendly_appointment, list/get/cancel (**no reschedule**) |
| GoHighLevel | crm + calendar | api_key + Location ID | contacts, tags, opportunities, tasks, notes, check_ghl_availability, book/get/reschedule/cancel appointments |
| HubSpot | crm | api_key (private app token) | contacts, deals, companies, tasks, notes, log_hubspot_call |
| Salesforce | crm | OAuth | contacts, leads, accounts, opportunities, cases, tasks, notes, SOQL |
| Dynamics 365 | crm | OAuth | contacts, tasks, notes, phone-call logging |
| Zoho CRM | crm | OAuth | contacts, deals, tasks, notes, call logging |
| monday.com | crm | OAuth | items and updates (missing from the docs, present in the live API) |
| Zendesk | support | OAuth | users, tickets, comments |
| Google Drive, OneDrive, Notion | knowledge_base | OAuth / api_key | knowledge-base sync only |

CRM providers also support contact sync and post-call write-back of extraction fields (`/update-crm-config`, `/run-sync-job`).

## Analysis and data
| Capability | Field | Notes |
|---|---|---|
| Post-call extraction | agent `post_call_analysis_data` (boolean, text, number, selector), `post_call_analysis_model` (default gpt-5.6-terra) | Built-in fields: `call_summary`, `user_sentiment`, `call_successful`, `in_voicemail`. Arrives in the `call_analyzed` webhook. Can be rerun with `PUT /rerun-call-analysis/{id}`. |
| Call records | `GET /v2/get-call/{id}`, `POST /v3/list-calls` | Transcript, recording URL, latency, cost, disconnection reason. |
| Webhooks | agent `webhook_url` + `webhook_events`, or account-level | Events: call_started, call_ended, call_analyzed (default), transcript_updated, transfer_*. |
| Contacts and memory | `/create-contact`, `contact_memory_config` | Remembers callers across calls (read is on by default, update off). |
| AI QA | dashboard | Scores real calls. First 100 minutes free, then $0.10/min. |
| Alerts and analytics | dashboard | |

## Compliance and privacy
| Capability | Field | Notes |
|---|---|---|
| HIPAA | Self-sign a BAA at click-agreements.retellai.com **before** any patient data (PHI) passes through | Needed for medical and dental clients. That's an owner/operator action, not something we can do. |
| GDPR / SOC 2 | DPA/SCCs self-signed | |
| Data storage | agent `data_storage_setting`: everything \| everything_except_pii \| basic_attributes_only; `data_storage_retention_days` 1–730; `pii_config` | Webhooks always carry the full raw data whatever this is set to. Raw files are deleted about 10 min after analysis on the stricter settings. |
| Signed recording URLs | `opt_in_signed_url`, `signed_url_expiration_ms` | Default expiry 24 h. |
| Recording-consent disclosure | none built in. Put it in `begin_message` | We must add the disclosure ourselves in states that require two-party consent **(inferred)**. |

Sources: https://docs.retellai.com/build/overview, /build/single-multi-prompt/*, /build/knowledge-base, /integrations/overview, /features/*, /general/compliance, /build/dynamic-variables, OpenAPI spec.

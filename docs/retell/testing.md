# Retell: testing

Last verified: 2026-11-16. Sources: https://docs.retellai.com/test/test-overview, /test/llm-simulation-testing, /test/batch-test-simulation, /test/test-web, /test/test-phone, /test/testing-pricing

Every test is billed at production rates. There is no free sandbox.

## Methods
| Method | Via API? | What it checks | Cost |
|---|---|---|---|
| **Simulation test cases + batch** | ✅ Fully | An AI caller follows a persona, and the transcript is graded pass/fail against success criteria | Per message (~$0.001–0.05), for both models, plus one analysis unit per case |
| Single playground turn | ✅ `POST /agent-playground-completion/{agent_id}` | A single response | Per message |
| Web call | Partly: `POST /v3/create-web-call` returns an access token, but someone needs a browser client to talk | Real audio, latency, interruptions | Voice rate, ~$0.07–0.31/min |
| Phone call | ✅ to start (`POST /v2/create-phone-call`), but a human has to answer | Telephony, transfers, keypad presses, carrier audio | Voice rate + ~$0.015/min, and needs a number ($2/mo) plus possibly KYC |

Custom-LLM and speech-to-speech agents can't be simulation-tested.

## Our standard test procedure (all API)
1. Write 6–12 test cases per client in `clients/<slug>/tests/cases.json`, covering: booking (happy path), FAQ (hours, prices, location), emergency leading to a transfer, after-hours, a wrong number or spam, an angry caller, a caller who refuses to give details, a mid-call change of mind, and a request for something they don't offer.
2. Create each case:
```bash
curl -X POST https://api.retellai.com/create-test-case-definition -H "Authorization: Bearer $RETELL_API_KEY" -H 'Content-Type: application/json' --data '{
  "name": "book-cleaning-happy-path",
  "response_engine": {"type": "retell-llm", "llm_id": "llm_…"},
  "user_prompt": "## Identity\nYou are Dana Lee, phone 555-0100.\n## Goal\nBook a teeth cleaning next Tuesday afternoon.\n## Personality\nFriendly, a bit rushed.",
  "metrics": ["The agent offered specific available times before booking.",
              "The agent confirmed name, phone and time back to the caller before booking.",
              "The agent ended the call with the end_call function."],
  "dynamic_variables": {"user_number": "+15550100"},
  "tool_mocks": [ ... mock EVERY custom/integration/code tool ... ]
}'
```
3. Run them: `POST /create-batch-test {"test_case_definition_ids": [...], "response_engine": {...}}`. Then poll `GET /get-batch-test/{id}` until `status: "complete"`, and read `pass_count`, `fail_count`, `error_count`, `total_count`.
4. For each failure: `GET /v2/list-test-runs/{batch_id}`, then `GET /get-test-run/{run_id}` for the transcript and explanation. Fix the prompt and rerun. **Judge each case on its pass rate across 2–3 runs**, since both the caller and the grader are LLMs.
5. Final check: one real phone call to the live number (by the operator, or an outbound call to the operator's phone).
6. Log results in `clients/<slug>/tests/results.md`.

## Rules
- **Mock every tool that touches a real system.** Unmocked custom, code, integration and MCP tools call production, which means real bookings. Transfers and SMS are always faked in simulation.
- All criteria in a case are judged together for a single verdict. Write one checkable behaviour per criterion.
- A test errors out after 10 minutes, after 400 utterances, or if the caller loops or the agent goes silent.
- Listing cases needs `?type=retell-llm&llm_id=…` (or `type=conversation-flow&conversation_flow_id=…`).
- The exact `tool_mocks` item shape (ToolMock / ToolMockInputMatchRule) should be checked in the OpenAPI spec before first use **(inferred)**.
- Environment tags (`prod`/`staging`) carry dynamic-variable values that apply to **live** calls. Never edit them for a test.

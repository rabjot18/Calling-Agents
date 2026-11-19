---
name: validate-receptionist
description: Validate a client's receptionist after every build or update. Confirms through the Retell API that the agent exists and is published, every function is registered and reachable, integrations authenticate, and the knowledge base, phone number and webhook are wired up. Then runs the simulation test batch, opens a local voice-orb test page so the operator can talk to the agent in the browser (a Retell web call), and reports what was built, assumed and couldn't be done, plus three test-call scenarios for the business type. Run right after build-receptionist finishes, and after any change to a live client.
---

# Validate a receptionist

Validation runs after `build-receptionist` and is never skipped. Run commands from the repo root.

## 1. Preconditions
`clients/<slug>/config/ids.json` must exist. If it doesn't, the build didn't finish: report that and stop. The validator reads these keys:
`agent_id`, `llm_id` (or `conversation_flow_id`), `published_version`, `phone_number`, `app_ids` (list), `kb_ids` (list), `vercel_url`, `test_case_ids` (list).
If the build forgot some of them, fill them in from the API first and save them.

## 2. Automated checks and simulation
```bash
python3 -I .claude/skills/validate-receptionist/scripts/validate.py <slug>
```
It writes `clients/<slug>/tests/validation.json` and `validation.md`, and exits non-zero if any check fails. It checks:

| Check | How | Pass when |
|---|---|---|
| API key | `GET /get-api-key-info` | 200 |
| Agent exists and is published | `GET /get-agent/{id}?version=<published>` | Found, with a matching response engine |
| Functions registered | `GET /get-retell-llm/{id}` (`general_tools`), plus the agent's pre/post-call tools | Every tool in `config/llm.json` is live; extras are flagged |
| Custom functions reachable | `GET <vercel_url>/api/health`, plus an **unsigned** POST to each custom tool | Health returns 200 and the unsigned POST is rejected with 401 (proving it's deployed and checking signatures, with no real action triggered) |
| Integrations authenticate | `POST /test-app-auth/{app_id}` for each app | `success: true` |
| Knowledge base ready | `GET /get-knowledge-base/{id}` | Status is complete or ready |
| Phone number bound | `GET /get-phone-number/{e164}` | `inbound_agents` contains the agent at the published version |
| Webhook reachable | The agent's `webhook_url` host's `/api/health` | 200 (skipped if no webhook) |
| Simulation | `POST /create-batch-test` with `test_case_ids` (or every case listed for the LLM), then poll `GET /get-batch-test` | All cases pass. Failures are listed with each run's explanation. |

Add `--no-sim` to skip the simulation, for example on a quick re-check after a fix. Simulations are billed per message.

**If anything fails:** fix it (go back to the relevant `build-receptionist` step), republish if the agent changed, and rerun. Allow at most 3 fix loops. Anything still failing goes under **Couldn't do**, with the reason and the operator walkthrough if one is needed.

## 3. Open the voice-orb test page
Start it as a **background** command so it keeps running after this turn:
```bash
set -a; source .env; set +a
python3 -I .claude/skills/validate-receptionist/scripts/test_page.py <slug>
```
- It serves `http://127.0.0.1:5174` (or the next free port), opens the browser, and prints the URL.
- The browser never sees the API key. The local server calls `POST /v3/create-web-call` for the published agent version and hands the page only a one-time access token. It binds to 127.0.0.1 only and rejects other Host headers.
- The page: tap the orb to start, allow the microphone, and talk. The orb moves with the agent's voice and with yours. Tap again to end. After the call it shows the transcript, summary, extracted data and latency (from `GET /v2/get-call`).
- **Draft testing:** `--version draft` talks to the latest unpublished draft instead.
- The server stops by itself after 30 minutes idle. To stop it sooner, stop the background task.
- Web calls can't test transfers or SMS (they're phone-only). Those scenarios need a call to the real number.

If the page fails to load the SDK or the call won't connect, check the browser console and the server output, record the cause in `docs/retell/gotchas.md`, and fix it.

## 4. Three test-call scenarios
Write `clients/<slug>/tests/manual-scenarios.md` with **three** scenarios specific to this business type, drawn from `docs/business-types/<type>.md` and `call-flow.md`:
1. **The most common call:** usually booking or the core request, on the happy path.
2. **The high-stakes call:** an emergency, urgent problem or transfer (mark it "use the phone number": transfers don't work in web calls).
3. **The tricky call:** after hours, a question the agent can't answer, a caller who won't give details, or a mid-call change of mind. Pick whichever is most likely to go wrong for this business.

Each scenario must fit on one screen:
```
### 1. <title> (web page / phone)
You are: <persona in one line>
Say: "<the opening line, word for word>"
Then: <1–2 follow-ups if the agent asks>
It should: <3–4 checkable behaviours>
Red flags: <what would mean it's broken>
```

## 5. Report
Update `clients/<slug>/REPORT.md` and give the operator the same summary:
- **Built:** agent name, ID and version, the model and tier, the phone number, each tool (native or custom), integrations (authenticated ✅/❌), the knowledge base, and the simulation pass rate.
- **Assumed:** every assumption from the build and the owner defaults used.
- **Couldn't do:** every failed check or skipped item, with the reason.
- **Your steps:** CLAUDE.md rule 8 walkthroughs (e.g. "Talk to the orb at <url>", forwarding the business line, OAuth sign-ins).
- **Test it yourself:** the test-page URL and the three scenarios.

Keep the message short. The details live in `REPORT.md`, `tests/validation.md` and `tests/manual-scenarios.md`.

# Vapi

Last verified: 2026-11-18
Docs fingerprint: not computed (the research-platform skill has not run yet; this file records what was used for the Pulse demo line).

Why it's here: Retell blocks phone-number purchases until KYC passes, and the owner's Retell KYC failed (manual review pending). Vapi gives one free US number with no card and no ID check, so the Pulse demo receptionist runs on Vapi until Retell is sorted.

## Key test
`curl -H "Authorization: Bearer $VAPI_API_KEY" "https://api.vapi.ai/assistant?limit=5"` → HTTP 200 on 2026-11-18 (key valid). Key lives in root `.env` and `saas/.env.local` as `VAPI_API_KEY` (the private key; the public key is for browser SDKs).

## What's built (Pulse demo line)
- Assistant `e6faf3a1-75c4-4065-8636-43034e7596a9`, "Maya - The Hazelnut Factory (Pulse demo)". Prompt is Pulse's own `buildAgentConfig` output for business `biz_5ca89bccafa74d9e86db`, adapted:
  - `{{current_time}}` / `{{current_calendar}}` → `{{"now" | date: "%A, %B %d, %Y, %I:%M %p", "America/New_York"}}`; `{{user_number}}` → `{{customer.number}}`.
  - `end_call` → Vapi's built-in `endCall` tool. No transfer (free numbers can't dial out), so the prompt says to take a message instead. Retell's `save_caller_details` extraction is not used.
  - Model `openai / gpt-4.1`, temperature 0.4; voice `11labs / Sarah` (was `vapi / Clara` until the tuning below); transcriber `deepgram / nova-3` with keyterms.
- Phone number `+1 207 679 0213` (id in `GET /phone-number`), provider `vapi`, inbound → that assistant. Took ~2 minutes from `activating` to `active`.
- Calls do NOT reach the Pulse dashboard yet (no server webhook; would need a public URL and a Vapi→Pulse mapper).

## Pulse integration (2026-11-18)
`VOICE_PLATFORM=vapi` in `saas/.env.local` makes Pulse build and run every receptionist on Vapi; anything else, or unset, means Retell. Each business row records the platform its `agent_id` lives on (`businesses.platform`, plus `phone_id` for the Vapi number id).
- `saas/src/lib/vapi-agent.ts` turns `buildAgentConfig` (the same source Retell uses) into an assistant:
  - It prepends "On this phone line" notes: `save_caller_details` isn't a tool, and there's no transfer on free numbers.
  - It maps the time variables, `end_call` → `endCall`, and the calendar custom tools → `function` tools pointing at `/api/vapi/tools`.
  - It turns post-call fields into an `analysisPlan.structuredDataPlan` schema, and boosted keywords into Deepgram `keyterm`s.
  - Onboarding, Teach, website imports and connection changes all rebuild it through `rebuildAgent`.
- Calls come into Pulse through `GET /call?assistantId=` ("Check for new calls"), mapped to Pulse's call shape by `toPulseCall`.
  - With a public https `APP_URL`, they also arrive through the `end-of-call-report` webhook at `/api/vapi/webhook`, checked with the `x-vapi-secret` header (= `VAPI_WEBHOOK_SECRET`).
  - Calls with no Vapi analysis get a Gemini summary from the transcript (`fillAnalysis`).
- The "Get a number" flow (`/api/golive`) calls `buyVapiNumber`, which asks for a free US number, trying area codes nearest Canada first.
- Browser test calls use `@vapi-ai/web@3.1.0`, with `VAPI_PUBLIC_KEY` and the assistant id.
- Voices are the ElevenLabs standard voices from the public `https://api.elevenlabs.io/v1/voices` (with previews). The id is stored as `11labs:<voice_id>`.
- Retell stays fully in the code; set `VOICE_PLATFORM=retell` to switch back.
- Not yet: the research-platform skill hasn't run for Vapi (no fingerprint), and `scripts/resync-agents.ts` only resyncs Retell agents.

## Tuning after the first real call (2026-11-18)
The first call showed four problems. Each got a fix through `PATCH /assistant/{id}`:
- **She cut the caller off mid-number.** A phone number read in chunks ("902… 555… 0143") got answered after each chunk and merged into 13 digits. Fix: `startSpeakingPlan: {waitSeconds: 0.5, transcriptionEndpointingPlan: {onPunctuationSeconds: 0.35, onNoPunctuationSeconds: 1.3, onNumberSeconds: 1.8}}`, plus a prompt rule: fewer than 10 digits means reply "Mm-hmm, go on".
- **"Okay"/"yeah" didn't interrupt her.** They are default acknowledgement phrases. Fix: `stopSpeakingPlan: {numWords: 0, voiceSeconds: 0.2, backoffSeconds: 1.0, acknowledgementPhrases: [], interruptionPhrases: [stop, wait, hold on, no, sorry, actually, okay, yeah, …]}` and `backgroundDenoisingEnabled: true`.
- **She was repetitive.** She read a 30 s list of hampers, repeated the item name every turn, re-asked her questions, and spelled the name phonetically twice. Fix: a "How to talk on the phone" section prepended to the prompt (≤25 words, ≤3 items, no re-asking, plain-letter spelling).
- **The voice was unclear and words were misheard.** Fix: voice `11labs / EXAVITQu4vr4xnSDxMaL` (Sarah), `eleven_turbo_v2_5`, stability 0.5, similarityBoost 0.8, speaker boost; Deepgram nova-3 `keyterm` list of 45 business and product words ("Thai boxes" was heard as "tie boxes").

## API patterns that worked
- `POST /assistant` with `firstMessage`, `model.messages[0]` (system prompt), `model.tools: [{type: "endCall"}]`, `voice`, `transcriber`, `endCallMessage`, `silenceTimeoutSeconds`, `maxDurationSeconds`.
- `POST /phone-number` `{provider: "vapi", assistantId, name, numberDesiredAreaCode: "207"}`. The area code is required for free numbers (error otherwise: "At least one of numberDesiredAreaCode, sipUri must be provided").
- `GET /phone-number/{id}` to poll `status` until `active`.

## Gotchas
- Legacy voices (Spencer, Neha, Harry, Cole, Paige, Hana, Lily, Kylie) are retired: `POST /assistant` returns 400. Active female voices include Clara, Emma, Layla (see https://docs.vapi.ai/providers/voice/vapi-voices).
- Free Vapi numbers: one per account, US area codes only, inbound only (no outbound, no transfers). They can run out in an area code; try another.
- `POST /chat` (text testing) returns 402 "Add a payment method to use chat" without a card on file.
- `GET /org` returns 401 with the private API key, so the credit balance can't be read this way.

Sources: https://docs.vapi.ai/phone-calling, https://docs.vapi.ai/calls/outbound-calling, https://docs.vapi.ai/providers/voice/vapi-voices

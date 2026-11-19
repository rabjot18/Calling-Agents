# Google Gemini API (reading menus, price lists, websites)

Last verified: 2026-11-17 (live tests from this machine)

## Use in Pickup
- **Code:**
  - `saas/src/lib/gemini.ts` (REST client, model fallback)
  - `saas/src/lib/ai.ts` (Gemini first, Anthropic if only `ANTHROPIC_API_KEY` is set)
- **Key:** `GEMINI_API_KEY` in `saas/.env.local`. The operator pasted it there themselves and didn't want it in chat. It's free tier, from aistudio.google.com → Get API key.
- **Optional override:** `GEMINI_MODEL=<id>` puts a model at the front of the fallback list.

## Key test
`GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=200` with header `x-goog-api-key: $GEMINI_API_KEY`. It returned HTTP 200 on 2026-11-17.

## API pattern that worked (plain REST)
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, with headers `x-goog-api-key` and `Content-Type: application/json`.
- **Body:** `{"contents":[{"role":"user","parts":[...]}],"generationConfig":{"responseMimeType":"application/json","responseSchema":{...},"temperature":0}}`
- **Schemas:** `responseSchema` uses the OpenAPI subset: uppercase `type` (`OBJECT`, `ARRAY`, `STRING`, `INTEGER`, `BOOLEAN`), `nullable: true`, `enum` on `STRING`, `required`, `description`.
- **Files:** sent as parts in the form `{"inlineData":{"mimeType":"image/png"|"application/pdf",...,"data":"<base64>"}}`. The app caps uploads at 14 MB because base64 adds about a third and inline requests are limited to about 20 MB.
- **Reading the reply:**
  - The text is at `candidates[0].content.parts[*].text`; skip parts with `thought: true`.
  - A block shows up as `promptFeedback.blockReason`, or as a `finishReason` other than `STOP` or `MAX_TOKENS`.

## Models (free-tier key, 2026-11-17)
**Listed:**
- `gemini-3.8-flash`, `3.7`, `3.6` and `3.5-flash`
- `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`
- the aliases `gemini-flash-latest`, `gemini-flash-lite-latest` and `gemini-pro-latest`
- `gemini-3.1-pro-preview`
- `gemini-4-argon`, `gemini-4-carbon` and `gemini-4-hydrogen`

**Results:**
- **Flash-Lite** (`3.5-flash-lite`, `flash-lite-latest`, `3.1-flash-lite`): fast (2–3 s) and accurate.
  - Read a 7-item salon price list from both a PNG and a PDF perfectly.
  - Kept "from $220" as written, turned "3.5 hrs" into 210 minutes, and caught "consultation required".
  - Website import found the address, 16 menu items and useful facts in 7.5 s.
  - **This is the first choice.**
- **Flash** (`3.5` to `3.8`, `flash-latest`): HTTP 503 "This model is currently experiencing high demand", or it hung for more than 45 s.
- **Pro / `pro-latest`, `gemini-4-carbon`, `gemini-4-argon`:** HTTP 429 (quota exceeded). These aren't usable on the free tier.
- **`gemini-4-hydrogen`:** timed out at 60 s.
- **`gemini-2.5-flash`:** HTTP 404, "no longer available to new users".

## Gotchas
- **503 "high demand" is common on Flash for free-tier keys.** Always fall back to another model; never surface the raw error to owners.
- **Long hangs need a hard timeout.** The app uses 30 s per model.
- **Free tier and data use:** Google may use free-tier requests to improve its products. That's fine for public menus and price lists. Turn on paid billing in AI Studio before customer data goes through Gemini.
- **Next.js:** the app's `server-only` imports need `--conditions=react-server` when you run `src/lib` code from a script with tsx.

- 2026-11-18: free-tier 503 "high demand" hits all Flash-Lite models at once in short bursts. Pulse now retries the whole model list up to 3 rounds (6 s, 12 s waits) when every model was only busy.

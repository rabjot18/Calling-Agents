import "server-only";

// Google Gemini over plain REST: reads menus, price lists and websites into structured JSON.
// Models are tried in order; a busy (503), rate-limited (429) or slow model hands over to the next.
// Flash-Lite goes first: on 2026-11-17 it read photo and PDF price lists perfectly in a few seconds, while the
// Flash models on a free-tier key returned 503 "high demand" or hung. GEMINI_MODEL overrides the first choice.
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODELS = [...new Set([process.env.GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash"].filter(Boolean) as string[])];
// Long menus mean long answers: allow up to 2 minutes per model before handing over to the next.
const TIMEOUT_MS = 120_000;

export const geminiAvailable = () => Boolean(process.env.GEMINI_API_KEY);

// Schemas use Gemini's OpenAPI subset (uppercase types, `nullable`).
export type GSchema = {
  type: string;
  nullable?: boolean;
  enum?: string[];
  description?: string;
  items?: GSchema;
  properties?: Record<string, GSchema>;
  required?: string[];
};
export type GPart = { text: string } | { inlineData: { mimeType: string; data: string } };

type GResponse = {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { code: number; message: string };
};

export async function geminiJSON<T>(parts: GPart[], schema: GSchema): Promise<T | null> {
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0,
      maxOutputTokens: 32768,
    }, // long menus need room
  });
  const errors: string[] = [];
  // Google's "high demand" 503s come in short bursts: when every model was only busy, wait and go round again (up to 3 rounds).
  for (let round = 0; round < 3; round++) {
    if (round) await new Promise((r) => setTimeout(r, round * 6_000));
    let busyOnly = true;
    for (const model of MODELS) {
      let res: Response;
      try {
        res = await fetch(`${BASE}/${model}:generateContent`, {
          method: "POST",
          headers: {
            "x-goog-api-key": process.env.GEMINI_API_KEY!,
            "Content-Type": "application/json",
          },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        errors.push(`${model}: ${e instanceof Error ? e.name : "network error"}`);
        busyOnly = false;
        continue; // timeout or dropped connection: try the next model
      }
      const data = (await res.json().catch(() => ({}))) as GResponse;
      if (res.status === 503 || res.status === 429 || res.status === 404 || res.status >= 500) {
        errors.push(`${model}: ${res.status} ${(data.error?.message ?? "").slice(0, 80)}`);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message ?? "request failed"}`);
      const cand = data.candidates?.[0];
      if (data.promptFeedback?.blockReason || !cand || (cand.finishReason && !["STOP", "MAX_TOKENS"].includes(cand.finishReason))) {
        errors.push(`${model}: blocked (${data.promptFeedback?.blockReason ?? cand?.finishReason})`);
        return null;
      }
      const text = (cand.content?.parts ?? [])
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text)
        .join("");
      try {
        return JSON.parse(text) as T;
      } catch {
        errors.push(`${model}: unreadable JSON (${cand.finishReason}, ${text.length} chars)`);
        busyOnly = false;
        continue;
      }
    }
    if (!busyOnly) break;
  }
  console.error(`Gemini unavailable: ${errors.join(" | ")}`);
  throw new Error("Reading is busy right now. Try again in a minute, or type your list instead.");
}

// Plain-text answer that may use Google's own fetcher and search (url_context + google_search). Google's crawler gets past
// the bot walls big chains put up. These tools need a paid Gemini plan; on the free tier (429) this quietly returns null.
export async function geminiResearch(prompt: string): Promise<string | null> {
  for (const model of MODELS) {
    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ url_context: {} }, { google_search: {} }],
          generationConfig: { temperature: 0, maxOutputTokens: 16384 },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429) return null; // not on this plan
      if (!res.ok) continue;
      const d = (await res.json()) as GResponse;
      const text = (d.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text)
        .join("");
      return text.trim() || null;
    } catch {
      continue;
    }
  }
  return null;
}

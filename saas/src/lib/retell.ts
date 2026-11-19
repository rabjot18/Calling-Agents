import "server-only";

// Thin REST client for Retell (docs/retell/ in the agency repo has the full API notes).
const BASE = "https://api.retellai.com";

export class RetellError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function retell<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.RETELL_API_KEY;
  if (!key) throw new RetellError(500, "RETELL_API_KEY is not set");
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    // 400s use {error_message}, 404s use {status, message}
    throw new RetellError(res.status, data.error_message || data.message || `Retell HTTP ${res.status}`);
  }
  return data as T;
}

export type RetellVoice = {
  voice_id: string;
  voice_name: string;
  provider: string;
  gender?: string;
  accent?: string;
  age?: string;
  preview_audio_url?: string;
};

// Newest fast model from the latest check (agency repo: build-receptionist/scripts/retell_models.py).
export const MODEL_CONFIG = {
  type: "cascading",
  primary: { model: "gpt-6.1-terra", tier: "fast" },
  backup: { model: "gpt-5.6-luna", tier: "fast", kick_in_timeout_ms: 1500 },
  temperature: 0,
};

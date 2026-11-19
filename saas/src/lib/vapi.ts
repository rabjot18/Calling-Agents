import "server-only";

// Thin REST client for Vapi (agency repo docs/vapi/README.md has the API notes and gotchas).
const BASE = "https://api.vapi.ai";

export class VapiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Which voice platform new and rebuilt receptionists use. VOICE_PLATFORM=vapi switches Pulse to Vapi; anything else is Retell.
export const onVapi = () => process.env.VOICE_PLATFORM === "vapi" && Boolean(process.env.VAPI_API_KEY);

export async function vapi<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new VapiError(500, "VAPI_API_KEY is not set");
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const m = Array.isArray(data.message) ? data.message.join("; ") : data.message;
    throw new VapiError(res.status, m || data.error || `Vapi HTTP ${res.status}`);
  }
  return data as T;
}

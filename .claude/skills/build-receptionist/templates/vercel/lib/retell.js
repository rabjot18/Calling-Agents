// Shared helpers for Retell custom functions and webhooks on Vercel.
// Verifies X-Retell-Signature: "v=<ms timestamp>,d=<hex HMAC-SHA256(raw_body + timestamp, RETELL_API_KEY)>"
import crypto from "node:crypto";

const MAX_SKEW_MS = 5 * 60 * 1000;

export async function readVerified(request) {
  const raw = await request.text();
  const sig = request.headers.get("x-retell-signature") || "";
  const m = sig.match(/^v=(\d+),d=([0-9a-f]+)$/i);
  if (!m) return { ok: false };
  const [, ts, digest] = m;
  if (Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return { ok: false };
  const expected = crypto.createHmac("sha256", process.env.RETELL_API_KEY || "").update(raw + ts).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(digest.toLowerCase());
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false };
  const body = raw ? JSON.parse(raw) : {};
  // With args_at_root=false Retell sends {name, call, args}; with true it sends args only.
  return { ok: true, body, args: body.args ?? body, call: body.call ?? null };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const unauthorized = () => json({ error: "unauthorized" }, 401);

// Wrap a tool handler: verify the signature, run it, and always return something the agent can speak from.
export function tool(handler) {
  return async function POST(request) {
    const v = await readVerified(request);
    if (!v.ok) return unauthorized();
    try {
      return json(await handler(v.args, v.call, v.body));
    } catch (err) {
      console.error(err);
      return json({ ok: false, message: "The system is unavailable right now. Take a message instead." });
    }
  };
}

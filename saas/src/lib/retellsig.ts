import "server-only";
import crypto from "node:crypto";

// Retell signs webhooks and custom-function calls the same way:
// header X-Retell-Signature = "v=<ms>,d=<hex HMAC-SHA256(rawBody + ms, RETELL_API_KEY)>". Rejects anything older than 5 minutes.
export function retellVerified(raw: string, sig: string | null): boolean {
  const m = sig?.match(/^v=(\d+),d=([0-9a-f]+)$/i);
  const key = process.env.RETELL_API_KEY;
  if (!m || !key || Math.abs(Date.now() - Number(m[1])) > 5 * 60_000) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", key).update(raw + m[1]).digest("hex"));
  const got = Buffer.from(m[2].toLowerCase());
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

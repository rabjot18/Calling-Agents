import "server-only";
import { timingSafeEqual } from "node:crypto";

// Vapi sends the assistant's server secret in x-vapi-secret on webhooks and tool calls. Anything without it is refused.
export function vapiVerified(req: Request): boolean {
  const want = process.env.VAPI_WEBHOOK_SECRET;
  const got = req.headers.get("x-vapi-secret");
  if (!want || !got) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

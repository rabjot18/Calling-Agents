import "server-only";
import { db } from "@/lib/db";
import { parseProfile } from "@/lib/profile";
import { fallbackReply, type ToolCall } from "@/lib/calendar-tools";
import { retellVerified } from "@/lib/retellsig";

// Retell custom-function request → the business it belongs to (by the calling agent's id). Signature-checked.
export type { ToolCall };
export async function readToolCall(req: Request): Promise<ToolCall | Response> {
  const raw = await req.text();
  if (!retellVerified(raw, req.headers.get("x-retell-signature"))) return new Response("unauthorized", { status: 401 });
  const body = JSON.parse(raw) as { call?: { agent_id?: string; call_id?: string }; args?: Record<string, unknown> };
  const row = db.prepare("SELECT id, profile_json FROM businesses WHERE agent_id = ?").get(body.call?.agent_id ?? "") as { id: string; profile_json: string } | undefined;
  if (!row) return Response.json({ ok: false, message: "Unknown business. Take a booking request instead." });
  return { businessId: row.id, profile: parseProfile(row.profile_json), callId: body.call?.call_id, args: body.args ?? {} };
}

// Anything that goes wrong is told to the agent in words it can act on: fall back to a request.
export const fallback = (why: string) => Response.json(fallbackReply(why));

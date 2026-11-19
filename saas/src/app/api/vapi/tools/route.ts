import { bookAppointment, checkAvailability, fallbackReply, type ToolReply } from "@/lib/calendar-tools";
import { db } from "@/lib/db";
import { parseProfile } from "@/lib/profile";
import { vapiVerified } from "@/lib/vapisig";

// Vapi tool calls (check_availability, book_appointment) → the same calendar logic the Retell routes use.
// Vapi posts {message: {type: "tool-calls", call, toolCallList: [{id, function: {name, arguments}}]}} and wants
// {results: [{toolCallId, result}]} back, with result as a string.
type ToolCallItem = { id: string; function?: { name?: string; arguments?: string | Record<string, unknown> } };

export async function POST(req: Request) {
  if (!vapiVerified(req)) return new Response("unauthorized", { status: 401 });
  const { message: m } = (await req.json()) as { message?: { call?: { id?: string; assistantId?: string }; toolCallList?: ToolCallItem[] } };
  const row = db.prepare("SELECT id, profile_json FROM businesses WHERE agent_id = ?").get(m?.call?.assistantId ?? "") as { id: string; profile_json: string } | undefined;
  const results = await Promise.all(
    (m?.toolCallList ?? []).map(async (tc) => {
      let reply: ToolReply;
      if (!row) reply = fallbackReply("This line isn't linked to a business.");
      else {
        const raw = tc.function?.arguments;
        let args: Record<string, unknown> = {};
        try { args = typeof raw === "string" ? JSON.parse(raw || "{}") : raw ?? {}; } catch { args = {}; }
        const t = { businessId: row.id, profile: parseProfile(row.profile_json), callId: m?.call?.id, args };
        const name = tc.function?.name;
        reply = name === "check_availability" ? await checkAvailability(t) : name === "book_appointment" ? await bookAppointment(t) : fallbackReply("That tool isn't available.");
      }
      return { toolCallId: tc.id, result: JSON.stringify(reply) };
    }),
  );
  return Response.json({ results });
}

import { upsertCall } from "@/lib/calls";
import { db } from "@/lib/db";
import { businessFor } from "@/lib/auth";
import { notifyCall } from "@/lib/notify";
import { vapiVerified } from "@/lib/vapisig";
import { fillAnalysis, toPulseCall, type VapiCall } from "@/lib/vapi-agent";

// Vapi server messages (needs a public https APP_URL). On end-of-call-report: save the call and send the owner its summary.
type Report = { type: string; call?: VapiCall; artifact?: VapiCall["artifact"]; analysis?: VapiCall["analysis"]; startedAt?: string; endedAt?: string; endedReason?: string };

export async function POST(req: Request) {
  if (!vapiVerified(req)) return new Response("unauthorized", { status: 401 });
  const { message: m } = (await req.json()) as { message?: Report };
  if (m?.type !== "end-of-call-report" || !m.call?.id) return new Response(null, { status: 204 });
  const call: VapiCall = {
    ...m.call,
    status: "ended",
    startedAt: m.startedAt ?? m.call.startedAt,
    endedAt: m.endedAt ?? m.call.endedAt,
    endedReason: m.endedReason ?? m.call.endedReason,
    artifact: m.artifact ?? m.call.artifact,
    analysis: m.analysis ?? m.call.analysis,
  };
  const biz = db.prepare("SELECT id, user_id FROM businesses WHERE agent_id = ?").get(call.assistantId ?? "") as { id: string; user_id: string } | undefined;
  if (!biz) return new Response(null, { status: 204 });
  const pulse = await fillAnalysis(toPulseCall(call));
  upsertCall(biz.id, pulse);
  if (pulse.call_analysis) await notifyCall(businessFor(biz.user_id), pulse.call_id);
  return new Response(null, { status: 204 });
}

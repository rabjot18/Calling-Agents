import "server-only";
import { db, now } from "./db";
import { saveBusiness, type Business } from "./auth";
import { retell } from "./retell";
import { notifyCall } from "./notify";
import { fillAnalysis, toPulseCall, type VapiCall } from "./vapi-agent";
import { vapi } from "./vapi";

export type RetellCall = {
  call_id: string;
  agent_id: string;
  call_type?: string;
  call_status?: string;
  start_timestamp?: number;
  duration_ms?: number;
  from_number?: string;
  recording_url?: string;
  transcript_object?: { role: string; content: string; words?: { start: number }[] }[];
  call_analysis?: { call_summary?: string; custom_analysis_data?: Record<string, unknown> };
  disconnection_reason?: string;
};

export type CallRow = {
  id: string;
  started_at: number;
  duration_ms: number | null;
  call_type: string | null;
  from_number: string | null;
  caller_name: string | null;
  reason: string | null;
  summary: string | null;
  outcome: string;
  urgency: string;
  after_hours: number;
  follow_up: number;
  done: number;
  appointment_time: string | null;
  service: string | null;
  transcript_json: string | null;
  recording_url: string | null;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function upsertCall(businessId: string, c: RetellCall) {
  const d = c.call_analysis?.custom_analysis_data ?? {};
  const outcome = str(d.outcome) ?? (c.call_analysis ? "Message" : "In progress");
  const lines = (c.transcript_object ?? []).map((t) => ({
    who: t.role === "agent" ? "agent" : "caller",
    text: t.content,
    at: Math.round((t.words?.[0]?.start ?? 0)),
  }));
  db.prepare(
    `INSERT INTO calls (id, business_id, started_at, duration_ms, call_type, from_number, caller_name, reason, summary, outcome, urgency,
       after_hours, follow_up, appointment_time, service, transcript_json, recording_url, analysis_json, status)
     VALUES (@id, @business_id, @started_at, @duration_ms, @call_type, @from_number, @caller_name, @reason, @summary, @outcome, @urgency,
       @after_hours, @follow_up, @appointment_time, @service, @transcript_json, @recording_url, @analysis_json, @status)
     ON CONFLICT(id) DO UPDATE SET duration_ms=excluded.duration_ms, caller_name=excluded.caller_name, reason=excluded.reason,
       summary=excluded.summary, outcome=excluded.outcome, urgency=excluded.urgency, after_hours=excluded.after_hours,
       follow_up=excluded.follow_up, appointment_time=excluded.appointment_time, service=excluded.service,
       transcript_json=excluded.transcript_json, recording_url=excluded.recording_url, analysis_json=excluded.analysis_json, status=excluded.status`
  ).run({
    id: c.call_id,
    business_id: businessId,
    started_at: c.start_timestamp ?? now(),
    duration_ms: c.duration_ms ?? null,
    call_type: c.call_type ?? null,
    from_number: c.from_number ?? null,
    caller_name: str(d.caller_name),
    reason: str(d.reason_for_call),
    summary: str(c.call_analysis?.call_summary),
    outcome,
    urgency: str(d.urgency) ?? "normal",
    after_hours: d.called_after_hours === true ? 1 : 0,
    follow_up: d.follow_up_needed === true ? 1 : 0,
    appointment_time: str(d.appointment_time),
    service: str(d.service_requested),
    transcript_json: JSON.stringify(lines),
    recording_url: c.recording_url ?? null,
    analysis_json: JSON.stringify(c.call_analysis ?? {}),
    status: c.call_status ?? null,
  });
}

// Pulls this business's recent calls from its voice platform (works locally, no public webhook needed).
export async function syncCalls(b: Business): Promise<number> {
  if (!b.agent_id) return 0;
  if (b.platform === "vapi") return syncVapiCalls(b);
  const list = await retell<{ items?: { call_id: string }[] }>("POST", "/v3/list-calls", {
    filter_criteria: { agent: [{ agent_id: b.agent_id }] },
    sort_order: "descending",
    limit: 50,
  });
  const known = new Map(
    (db.prepare("SELECT id, analysis_json FROM calls WHERE business_id = ?").all(b.id) as { id: string; analysis_json: string }[]).map((r) => [r.id, r.analysis_json])
  );
  let n = 0;
  for (const item of list.items ?? []) {
    const prev = known.get(item.call_id);
    if (prev && prev !== "{}") continue; // already analysed
    const full = await retell<RetellCall>("GET", `/v2/get-call/${item.call_id}`);
    if (full.call_status === "registered" || full.call_status === "not_connected") continue;
    upsertCall(b.id, full);
    await notifyCall(b, full.call_id); // email + WhatsApp once, only when analysed and recent
    n++;
  }
  saveBusiness(b.id, { last_synced_at: now() });
  return n;
}

async function syncVapiCalls(b: Business): Promise<number> {
  const list = await vapi<VapiCall[]>("GET", `/call?assistantId=${encodeURIComponent(b.agent_id!)}&limit=50`);
  const known = new Map(
    (db.prepare("SELECT id, analysis_json FROM calls WHERE business_id = ?").all(b.id) as { id: string; analysis_json: string }[]).map((r) => [r.id, r.analysis_json])
  );
  let n = 0;
  for (const c of list) {
    if (c.status !== "ended") continue; // still ringing or in progress
    const prev = known.get(c.id);
    if (prev && prev !== "{}") continue; // already analysed
    const call = await fillAnalysis(toPulseCall(c));
    upsertCall(b.id, call);
    if (call.call_analysis) await notifyCall(b, call.call_id);
    n++;
  }
  saveBusiness(b.id, { last_synced_at: now() });
  return n;
}

export function listCalls(businessId: string, limit = 500): CallRow[] {
  return db.prepare("SELECT * FROM calls WHERE business_id = ? ORDER BY started_at DESC LIMIT ?").all(businessId, limit) as CallRow[];
}

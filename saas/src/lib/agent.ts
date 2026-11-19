import "server-only";
import { businessFor, saveBusiness, type Business } from "./auth";
import { publicUrl } from "./google";
import { activeProvider } from "./calendar";
import { buildAgentConfig } from "./prompt";
import { MODEL_CONFIG, retell } from "./retell";
import { onVapi } from "./vapi";
import { publishVapi, syncVapi } from "./vapi-agent";

// Creates or updates the business's Retell LLM + agent from its profile. Returns the agent id.
export async function syncAgent(b: Business): Promise<string> {
  if (onVapi()) return syncVapi(b, calendarBaseFor(b.id));
  const p = b.profile;
  const cfg = buildAgentConfig(p, { calendarBase: calendarBaseFor(b.id) });
  const llmBody = {
    start_speaker: "agent",
    begin_message: cfg.begin_message,
    general_prompt: cfg.general_prompt,
    general_tools: cfg.general_tools,
    model_config: MODEL_CONFIG,
  };
  let llmId = b.llm_id;
  if (llmId) await retell("PATCH", `/update-retell-llm/${llmId}`, llmBody);
  else llmId = (await retell<{ llm_id: string }>("POST", "/create-retell-llm", llmBody)).llm_id;

  const agentBody = {
    agent_name: `${p.name || "Business"} – ${p.receptionist.name}`,
    response_engine: { type: "retell-llm", llm_id: llmId },
    voice_id: p.receptionist.voiceId || "retell-Chloe",
    language: "en-US",
    timezone: p.timezone,
    boosted_keywords: cfg.boosted_keywords,
    post_call_analysis_data: cfg.post_call_analysis_data,
    end_call_after_silence_ms: 30000,
    max_call_duration_ms: 900000,
    enable_dnc_detection: true,
    // Retell's own moderation layer, independent of the prompt: blocks harmful agent output and caller jailbreak attempts.
    guardrail_config: {
      output_topics: ["harassment", "self_harm", "sexual_exploitation", "violence", "defense_and_national_security", "illicit_and_harmful_activity", "gambling", "regulated_professional_advice", "child_safety_and_exploitation"],
      input_topics: ["platform_integrity_jailbreaking"],
    },
    data_storage_setting: ["clinic", "dental"].includes(p.type) ? "everything_except_pii" : "everything",
    data_storage_retention_days: 365,
    ...(process.env.APP_URL?.startsWith("https://") ? { webhook_url: `${process.env.APP_URL}/api/retell/webhook`, webhook_events: ["call_analyzed", "transfer_started"] } : {}),
  };
  let agentId = b.agent_id;
  if (agentId) {
    const { response_engine: _ignored, ...upd } = agentBody;
    void _ignored;
    await retell("PATCH", `/update-agent/${agentId}`, upd);
  } else {
    agentId = (await retell<{ agent_id: string }>("POST", "/create-agent", agentBody)).agent_id;
  }
  saveBusiness(b.id, { llm_id: llmId, agent_id: agentId, platform: "retell" });
  return agentId;
}

// Live booking tools only when a calendar (Google or Outlook) is connected AND Retell can reach us (public https APP_URL).
export function calendarBaseFor(businessId: string): string | undefined {
  return activeProvider(businessId) ? publicUrl() ?? undefined : undefined;
}

// After a connection changes: rebuild the receptionist's prompt/tools; publish again if it's live.
export async function rebuildAgent(userId: string) {
  const b = businessFor(userId);
  if (!b.agent_id) return;
  await syncAgent(b);
  if (b.status === "live") await publishAgent(businessFor(userId));
}

export async function publishAgent(b: Business): Promise<number> {
  if (!b.agent_id) throw new Error("Agent not built yet");
  if (b.platform === "vapi") { await publishVapi(b); return 0; }
  await retell("POST", `/publish-agent-version/${b.agent_id}`);
  const versions = await retell<{ version: number; is_published?: boolean }[]>("GET", `/list-agent-versions/${b.agent_id}`);
  const published = versions.filter((v) => v.is_published !== false).map((v) => v.version);
  const version = published.length ? Math.max(...published) : 0;
  saveBusiness(b.id, { published_version: version, status: "live" });
  if (b.phone_number)
    await retell("PATCH", `/update-phone-number/${encodeURIComponent(b.phone_number)}`, {
      inbound_agents: [{ agent_id: b.agent_id, agent_version: version, weight: 1 }],
    });
  return version;
}

// Re-sends the current prompt and tools to every business that already has a receptionist.
// Run after changing src/lib/prompt.ts:
//   npx tsx --conditions=react-server --env-file=.env.local scripts/resync-agents.ts
// Uses only the prompt builder and the Retell client (the app's auth code needs the Next.js runtime).
import Database from "better-sqlite3";
import { buildAgentConfig } from "@/lib/prompt";
import { parseProfile } from "@/lib/profile";
import { MODEL_CONFIG, retell } from "@/lib/retell";

type Row = { id: string; llm_id: string; agent_id: string; status: string; profile_json: string };

async function main() {
  const db = new Database("data/app.db", { readonly: true });
  const rows = db.prepare("SELECT id, llm_id, agent_id, status, profile_json FROM businesses WHERE agent_id IS NOT NULL AND llm_id IS NOT NULL").all() as Row[];
  for (const r of rows) {
    const p = parseProfile(r.profile_json);
    const g = db.prepare("SELECT status FROM connections WHERE business_id = ? AND provider IN ('google','microsoft') AND status = 'ok'").get(r.id) as { status: string } | undefined;
    const pub = (process.env.APP_URL ?? "").startsWith("https://") ? process.env.APP_URL : undefined;
    const cfg = buildAgentConfig(p, { calendarBase: g?.status === "ok" ? pub : undefined });
    try {
      await retell("PATCH", `/update-retell-llm/${r.llm_id}`, {
        begin_message: cfg.begin_message,
        general_prompt: cfg.general_prompt,
        general_tools: cfg.general_tools,
        model_config: MODEL_CONFIG,
      });
      if (r.status === "live") await retell("POST", `/publish-agent-version/${r.agent_id}`);
      console.log(`updated: ${p.name || r.id} (${r.status})`);
    } catch (e) {
      console.log(`FAILED: ${p.name || r.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
}
main();

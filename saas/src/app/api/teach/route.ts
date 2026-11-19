import { publishAgent, syncAgent } from "@/lib/agent";
import { businessFor, saveBusiness } from "@/lib/auth";
import { fail, json, publicBusiness, withBusiness } from "@/lib/http";

// "Tell Maya something new": adds a fact in plain words and updates the live receptionist.
export const POST = withBusiness(async (b, req) => {
  const { text, remove } = (await req.json()) as { text?: string; remove?: number };
  const extra = [...b.profile.extra];
  if (typeof remove === "number") extra.splice(remove, 1);
  else if (text?.trim()) extra.push(text.trim().slice(0, 500));
  else return fail("Write what Maya should know.");
  saveBusiness(b.id, { profile: { ...b.profile, extra } });
  const fresh = businessFor(b.user_id);
  if (fresh.agent_id) {
    await syncAgent(fresh);
    // A live number is pinned to the published version, so publish again for callers to hear the change.
    if (fresh.status === "live") await publishAgent(businessFor(b.user_id));
  }
  return json(publicBusiness(businessFor(b.user_id)));
});

import { syncAgent } from "@/lib/agent";
import { businessFor } from "@/lib/auth";
import { fail, json, publicBusiness, withBusiness } from "@/lib/http";

// Builds (first time) or updates the receptionist from the current profile.
export const POST = withBusiness(async (b) => {
  if (!b.profile.name) return fail("Add your business name first.");
  await syncAgent(b);
  return json(publicBusiness(businessFor(b.user_id)));
});

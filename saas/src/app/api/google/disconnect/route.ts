import { businessFor } from "@/lib/auth";
import { rebuildAgent } from "@/lib/agent";
import { disconnectGoogle } from "@/lib/google";
import { json, publicBusiness, withBusiness } from "@/lib/http";

export const POST = withBusiness(async (b) => {
  await disconnectGoogle(b.id);
  await rebuildAgent(b.user_id); // back to booking requests
  return json(publicBusiness(businessFor(b.user_id)));
});

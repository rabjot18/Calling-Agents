import { businessFor } from "@/lib/auth";
import { rebuildAgent } from "@/lib/agent";
import { msDisconnect } from "@/lib/microsoft";
import { json, publicBusiness, withBusiness } from "@/lib/http";

export const POST = withBusiness(async (b) => {
  msDisconnect(b.id);
  await rebuildAgent(b.user_id);
  return json(publicBusiness(businessFor(b.user_id)));
});

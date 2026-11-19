import { fail, json, withBusiness } from "@/lib/http";
import { retell } from "@/lib/retell";

// Mints a one-time web-call token for the owner's own agent. The API key never reaches the browser.
// On Vapi the browser starts the call itself with the public key (made for browsers) and the assistant id.
export const POST = withBusiness(async (b) => {
  if (!b.agent_id) return fail("Build your receptionist first.");
  if (b.platform === "vapi") {
    const publicKey = process.env.VAPI_PUBLIC_KEY;
    if (!publicKey) return fail("Browser test calls need the Vapi public key in the app settings.", 503);
    return json({ platform: "vapi", publicKey, assistantId: b.agent_id });
  }
  const r = await retell<{ call_id: string; access_token: string; transport: string; ice_servers: unknown[] }>("POST", "/v3/create-web-call", {
    agent_id: b.agent_id,
    metadata: { source: "owner-test", business_id: b.id },
  });
  return json({ callId: r.call_id, accessToken: r.access_token, transport: r.transport, iceServers: r.ice_servers });
});

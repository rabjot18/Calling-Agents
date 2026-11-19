import "server-only";
import { apiBusiness, type Business } from "./auth";
import { nextQuestion } from "./packs";
import { emailAvailable } from "./email";
import { googleAvailable, googleConnection, publicUrl } from "./google";
import { microsoftAvailable, msConnection } from "./microsoft";
import { usingSandbox, whatsappAvailable } from "./whatsapp";
import { RetellError } from "./retell";
import { onVapi, VapiError } from "./vapi";

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const fail = (message: string, status = 400) => json({ error: message }, status);

// Wraps a handler that needs the signed-in business; maps errors to JSON.
export function withBusiness(fn: (b: Business, req: Request) => Promise<Response>) {
  return async (req: Request) => {
    const b = await apiBusiness();
    if (!b) return fail("Please sign in again.", 401);
    try {
      return await fn(b, req);
    } catch (e) {
      console.error(e);
      if (e instanceof RetellError || e instanceof VapiError) return fail(`Voice platform: ${e.message}`, 502);
      return fail(e instanceof Error ? e.message : "Something went wrong", 500);
    }
  };
}

export const publicBusiness = (b: Business) => ({
  profile: b.profile,
  step: b.onboarding_step,
  agentId: b.agent_id,
  phoneNumber: b.phone_number,
  voicePlatform: onVapi() ? "vapi" : "retell",
  // The in-browser "Try Maya now" call in setup: Retell always, Vapi only with its public (browser) key.
  browserTest: !onVapi() || Boolean(process.env.VAPI_PUBLIC_KEY),
  status: b.status,
  publishedVersion: b.published_version,
  next: nextQuestion(b.profile),
  connections: {
    google: googleConnection(b.id),
    googleReady: googleAvailable(),
    microsoft: msConnection(b.id),
    microsoftReady: microsoftAvailable(),
    liveBooking: Boolean(publicUrl()),
    emailReady: emailAvailable(),
    whatsappReady: whatsappAvailable(),
    whatsappSandbox: usingSandbox(),
  },
});

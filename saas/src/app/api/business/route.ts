import { businessFor, saveBusiness } from "@/lib/auth";
import { fail, json, publicBusiness, withBusiness } from "@/lib/http";
import { BUSINESS_TYPES, toE164 } from "@/lib/packs";
import type { Profile } from "@/lib/profile";

export const GET = withBusiness(async (b) => json(publicBusiness(b)));

const STEPS = ["find", "type", "interview", "review", "connect", "voice", "live", "done"];

// Partial profile edits from onboarding screens and settings. Only known top-level keys are accepted.
export const PATCH = withBusiness(async (b, req) => {
  const body = (await req.json()) as { profile?: Partial<Profile>; step?: string };
  const allowed: (keyof Profile)[] = ["name", "type", "website", "address", "phone", "timezone", "hours", "holidays", "callerNeeds", "catalog", "staff", "transfer", "notifyEmail", "notifyWhatsApp", "extra", "receptionist"];
  const profile = { ...b.profile };
  for (const k of allowed) if (body.profile && k in body.profile) (profile as Record<string, unknown>)[k] = body.profile[k];
  if (typeof profile.notifyWhatsApp === "string" && profile.notifyWhatsApp.trim()) {
    const e164 = toE164(profile.notifyWhatsApp);
    if (!e164) return fail("Enter the WhatsApp number with its country code, like +1 902 555 0123.");
    profile.notifyWhatsApp = e164;
  }
  if (body.profile?.type && !BUSINESS_TYPES.some((t) => t.id === body.profile!.type)) profile.type = "other";
  const step = body.step && STEPS.includes(body.step) ? body.step : undefined;
  saveBusiness(b.id, { profile, ...(step ? { onboarding_step: step } : {}) });
  return json(publicBusiness(businessFor(b.user_id)));
});

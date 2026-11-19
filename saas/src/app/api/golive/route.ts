import { publishAgent, syncAgent } from "@/lib/agent";
import { businessFor, saveBusiness } from "@/lib/auth";
import { fail, json, publicBusiness, withBusiness } from "@/lib/http";
import { retell } from "@/lib/retell";
import { onVapi } from "@/lib/vapi";
import { buyVapiNumber } from "@/lib/vapi-agent";

// Publishes the receptionist and gives it a phone number (bought on Retell: US/CA, about $2/month). Used by the last
// onboarding step and by the Settings page for businesses that skipped it.
export const POST = withBusiness(async (b, req) => {
  const { areaCode, country = "US", confirmPurchase, testOnly } = (await req.json()) as { areaCode?: string; country?: "US" | "CA"; confirmPurchase?: boolean; testOnly?: boolean };
  await syncAgent(b);
  if (testOnly) {
    // Test mode: no number is bought yet. The owner can get one later from the Receptionist page.
    saveBusiness(b.id, { onboarding_step: "done", status: "test" });
    return json(publicBusiness(businessFor(b.user_id)));
  }
  let fresh = businessFor(b.user_id);
  // Vapi: a free US number (inbound only), no purchase to confirm.
  if (onVapi() && !fresh.phone_number) {
    await buyVapiNumber(fresh, areaCode);
    fresh = businessFor(b.user_id);
  }
  if (!fresh.phone_number) {
    if (!confirmPurchase) return fail("Confirm the number purchase to continue.");
    const body: Record<string, unknown> = { country_code: country, number_provider: "twilio", nickname: fresh.profile.name.slice(0, 40) };
    if (areaCode && /^\d{3}$/.test(areaCode) && country === "US") body.area_code = Number(areaCode); // Retell: US only
    if (fresh.profile.transfer.number) body.fallback_number = fresh.profile.transfer.number;
    let num: { phone_number: string };
    try {
      num = await retell<{ phone_number: string }>("POST", "/create-phone-number", body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("number purchase failed:", m);
      if (/card|payment|billing|balance|credit/i.test(m)) return fail("Pulse's phone provider needs a payment card on file before it can add a number.", 402);
      if (/area|available|inventory|no.*number/i.test(m)) return fail("No numbers left in that area code. Try a nearby one, or leave it blank.");
      return fail("Couldn't get a number right now. Try again in a minute.", 502);
    }
    saveBusiness(b.id, { phone_number: num.phone_number });
    fresh = businessFor(b.user_id);
  }
  await publishAgent(fresh);
  saveBusiness(b.id, { onboarding_step: "done" });
  return json(publicBusiness(businessFor(b.user_id)));
});

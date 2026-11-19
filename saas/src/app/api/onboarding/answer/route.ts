import { businessFor, saveBusiness } from "@/lib/auth";
import { fail, json, publicBusiness, withBusiness } from "@/lib/http";
import { applyAnswer, questions, toE164, type Answer } from "@/lib/packs";

export const POST = withBusiness(async (b, req) => {
  const { questionId, answer } = (await req.json()) as { questionId: string; answer: Answer };
  // The services/menu question is answered after the list is saved, when it may already have left the
  // question list; record it directly rather than failing.
  if (questionId === "catalog") {
    const profile = { ...b.profile, answers: { ...b.profile.answers, catalog: typeof answer === "string" ? answer : "typed" } };
    saveBusiness(b.id, { profile });
    return json(publicBusiness(businessFor(b.user_id)));
  }
  const q = questions(b.profile).find((x) => x.id === questionId);
  // A question can drop out when an earlier answer changes what's asked. Move on quietly instead of erroring.
  if (!q) return json(publicBusiness(businessFor(b.user_id)));
  if (q.kind === "phone" && (typeof answer !== "string" || !toE164(answer)))
    return fail("That doesn't look like a full phone number. Include the area code, e.g. 902 555 0143.");
  if (q.kind === "email" && (typeof answer !== "string" || !/^\S+@\S+\.\S+$/.test(answer))) return fail("That doesn't look like an email address.");
  const profile = applyAnswer(b.profile, q, answer);
  saveBusiness(b.id, { profile });
  return json(publicBusiness(businessFor(b.user_id)));
});

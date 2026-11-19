import { redirect } from "next/navigation";
import { businessFor, requireUser } from "@/lib/auth";
import { Onboarding } from "@/components/Onboarding";
import { aiAvailable } from "@/lib/ai";
import { publicBusiness } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const u = await requireUser();
  const b = businessFor(u.id);
  if (b.onboarding_step === "done") redirect("/dashboard");
  return (
    <Onboarding
      initial={{ profile: b.profile, step: b.onboarding_step, agentId: b.agent_id, phoneNumber: b.phone_number, status: b.status, publishedVersion: b.published_version, connections: publicBusiness(b).connections }}
      aiReady={aiAvailable()}
      accountEmail={u.email}
    />
  );
}

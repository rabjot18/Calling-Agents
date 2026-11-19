import { businessFor, requireUser } from "@/lib/auth";
import { listCalls } from "@/lib/calls";
import { CallBrowser } from "@/components/Dashboard";

export default async function CallsPage() {
  const u = await requireUser();
  const b = businessFor(u.id);
  return <CallBrowser calls={listCalls(b.id)} mode="inbox" agentName={b.profile.receptionist.name} timezone={b.profile.timezone} />;
}

import { businessFor, requireUser } from "@/lib/auth";
import { listCalls } from "@/lib/calls";
import { CallBrowser } from "@/components/Dashboard";

export default async function HistoryPage({ searchParams }: PageProps<"/dashboard/history">) {
  const sp = await searchParams;
  const u = await requireUser();
  const b = businessFor(u.id);
  return <CallBrowser key={JSON.stringify(sp)} calls={listCalls(b.id, 5000)} mode="history" agentName={b.profile.receptionist.name} timezone={b.profile.timezone} />;
}

import { redirect } from "next/navigation";
import { businessFor, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Nav } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const u = await requireUser();
  const b = businessFor(u.id);
  if (b.onboarding_step !== "done") redirect("/onboarding");
  // The count on "Needs you": urgent calls and call-back requests not yet ticked off.
  const waiting = db
    .prepare("SELECT COUNT(*) AS n, SUM(urgency = 'urgent') AS u FROM calls WHERE business_id = ? AND done = 0 AND (follow_up = 1 OR urgency = 'urgent')")
    .get(b.id) as { n: number; u: number | null };
  return (
    <div className="shell">
      <Nav business={b.profile.name} agentName={b.profile.receptionist.name} live={b.status === "live"} needs={waiting.n} urgent={waiting.u ?? 0} timezone={b.profile.timezone} />
      <main className="page">{children}</main>
    </div>
  );
}

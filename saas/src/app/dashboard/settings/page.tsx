import { businessFor, requireUser } from "@/lib/auth";
import { SettingsView } from "@/components/Dashboard";
import { publicBusiness } from "@/lib/http";

export default async function SettingsPage() {
  const u = await requireUser();
  const b = businessFor(u.id);
  return <SettingsView profile={b.profile} phone={b.phone_number} status={b.status} connections={publicBusiness(b).connections} accountEmail={u.email} freeNumber={publicBusiness(b).voicePlatform === "vapi"} />;
}

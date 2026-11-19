import { cookies } from "next/headers";
import { businessFor, currentUser } from "@/lib/auth";
import { rebuildAgent } from "@/lib/agent";
import { disconnectOtherCalendar } from "@/lib/calendar";
import { msConnectWithCode } from "@/lib/microsoft";

// Microsoft sends the owner back here. Check state, store the (encrypted) refresh token, swap the receptionist to live booking.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.APP_URL ?? url.origin;
  const jar = await cookies();
  const [state, back = "/dashboard/settings"] = (jar.get("ms_oauth")?.value ?? "").split("|");
  jar.delete({ name: "ms_oauth", path: "/api/microsoft" });
  const u = await currentUser();
  if (!u) return Response.redirect(`${base}/login`, 302);
  if (!state || url.searchParams.get("state") !== state) return Response.redirect(`${base}${back}?outlook=error`, 302);
  if (url.searchParams.get("error")) {
    console.error("outlook consent error:", url.searchParams.get("error"), url.searchParams.get("error_description")?.slice(0, 200));
    return Response.redirect(`${base}${back}?outlook=${url.searchParams.get("error") === "access_denied" ? "cancelled" : "error"}`, 302);
  }
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(`${base}${back}?outlook=error`, 302);
  try {
    const b = businessFor(u.id);
    await msConnectWithCode(b.id, code);
    await disconnectOtherCalendar(b.id, "microsoft");
    await rebuildAgent(u.id);
    return Response.redirect(`${base}${back}?outlook=connected`, 302);
  } catch (e) {
    console.error("outlook connect failed:", e instanceof Error ? e.message : e);
    return Response.redirect(`${base}${back}?outlook=error`, 302);
  }
}

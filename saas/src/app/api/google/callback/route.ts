import { cookies } from "next/headers";
import { businessFor, currentUser } from "@/lib/auth";
import { rebuildAgent } from "@/lib/agent";
import { connectWithCode } from "@/lib/google";
import { disconnectOtherCalendar } from "@/lib/calendar";

// Google sends the owner back here. Check state, store the (encrypted) refresh token, give the receptionist the booking tools.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.APP_URL ?? url.origin;
  const jar = await cookies();
  const [state, back = "/dashboard/settings"] = (jar.get("g_oauth")?.value ?? "").split("|");
  jar.delete({ name: "g_oauth", path: "/api/google" });
  const u = await currentUser();
  if (!u) return Response.redirect(`${base}/login`, 302);
  if (!state || url.searchParams.get("state") !== state) return Response.redirect(`${base}${back}?google=error&why=state`, 302);
  if (url.searchParams.get("error")) return Response.redirect(`${base}${back}?google=cancelled`, 302);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(`${base}${back}?google=error`, 302);
  try {
    const b = businessFor(u.id);
    await connectWithCode(b.id, code);
    await disconnectOtherCalendar(b.id, "google"); // one calendar at a time
    await rebuildAgent(u.id);
    return Response.redirect(`${base}${back}?google=connected`, 302);
  } catch (e) {
    console.error("google connect failed:", e instanceof Error ? e.message : e);
    return Response.redirect(`${base}${back}?google=error`, 302);
  }
}

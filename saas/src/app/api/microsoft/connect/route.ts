import crypto from "node:crypto";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { microsoftAvailable, msAuthUrl } from "@/lib/microsoft";

// Starts "Connect Outlook": state cookie (CSRF) + where to return, then Microsoft's sign-in and consent.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = ["/onboarding", "/dashboard/settings"].includes(url.searchParams.get("return") ?? "") ? url.searchParams.get("return")! : "/dashboard/settings";
  const base = process.env.APP_URL ?? url.origin;
  const u = await currentUser();
  if (!u) return Response.redirect(`${base}/login`, 302);
  if (!microsoftAvailable()) return Response.redirect(`${base}${back}?outlook=unavailable`, 302);
  const state = crypto.randomBytes(24).toString("base64url");
  (await cookies()).set("ms_oauth", `${state}|${back}`, { httpOnly: true, sameSite: "lax", secure: base.startsWith("https://"), path: "/api/microsoft", maxAge: 600 });
  return Response.redirect(msAuthUrl(state), 302);
}

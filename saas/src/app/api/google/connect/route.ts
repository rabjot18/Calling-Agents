import crypto from "node:crypto";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { authUrl, googleAvailable } from "@/lib/google";

// Starts "Connect Google Calendar": state cookie (CSRF) + where to return, then off to Google's consent screen.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = ["/onboarding", "/dashboard/settings"].includes(url.searchParams.get("return") ?? "") ? url.searchParams.get("return")! : "/dashboard/settings";
  const base = process.env.APP_URL ?? url.origin;
  const u = await currentUser();
  if (!u) return Response.redirect(`${base}/login`, 302);
  if (!googleAvailable()) return Response.redirect(`${base}${back}?google=unavailable`, 302);
  const state = crypto.randomBytes(24).toString("base64url");
  (await cookies()).set("g_oauth", `${state}|${back}`, { httpOnly: true, sameSite: "lax", secure: base.startsWith("https://"), path: "/api/google", maxAge: 600 });
  return Response.redirect(authUrl(state, u.email), 302);
}

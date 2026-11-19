import { createUser, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, json } from "@/lib/http";

export async function POST(req: Request) {
  const { email, name, password } = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email.");
  if (!password || password.length < 8) return fail("Use at least 8 characters for your password.");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email.toLowerCase().trim())) return fail("That email already has an account. Sign in instead.");
  const user = await createUser(email, name ?? "", password);
  await startSession(user.id);
  return json({ ok: true });
}

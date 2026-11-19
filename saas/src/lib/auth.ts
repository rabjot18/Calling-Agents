import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, newId, now } from "./db";
import { emptyProfile, parseProfile, type Profile } from "./profile";

const COOKIE = "pickup_session";
const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

export type User = { id: string; email: string; name: string };
export type BusinessRow = {
  id: string;
  user_id: string;
  profile_json: string;
  onboarding_step: string;
  llm_id: string | null;
  agent_id: string | null;
  published_version: number | null;
  phone_number: string | null;
  calcom_app_id: string | null;
  platform: string; // "retell" or "vapi": where agent_id lives
  phone_id: string | null; // the platform's id for phone_number (Vapi)
  status: string;
  last_synced_at: number | null;
};
export type Business = BusinessRow & { profile: Profile };

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 11);
}

export async function createUser(email: string, name: string, password: string): Promise<User> {
  const id = newId("usr");
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id, email.toLowerCase().trim(), name.trim(), await hashPassword(password), now()
  );
  const profile = emptyProfile();
  db.prepare("INSERT INTO businesses (id, user_id, profile_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    newId("biz"), id, JSON.stringify(profile), now(), now()
  );
  return { id, email, name };
}

export async function checkPassword(email: string, password: string): Promise<User | null> {
  const row = db.prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?").get(email.toLowerCase().trim()) as
    | (User & { password_hash: string })
    | undefined;
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return null;
  return { id: row.id, email: row.email, name: row.name };
}

export async function startSession(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, now() + THIRTY_DAYS);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // HTTPS-only cookies only when the app is really served over HTTPS; on http://localhost Safari would drop it.
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: THIRTY_DAYS / 1000,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare("SELECT u.id, u.email, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?")
    .get(token) as (User & { expires_at: number }) | undefined;
  if (!row || row.expires_at < now()) return null;
  return { id: row.id, email: row.email, name: row.name };
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export function businessFor(userId: string): Business {
  const row = db.prepare("SELECT * FROM businesses WHERE user_id = ? LIMIT 1").get(userId) as BusinessRow;
  return { ...row, profile: parseProfile(row.profile_json) };
}

export function saveBusiness(id: string, patch: Partial<BusinessRow> & { profile?: Profile }) {
  const { profile, ...cols } = patch;
  const sets: string[] = ["updated_at = @updated_at"];
  const vals: Record<string, unknown> = { id, updated_at: now() };
  if (profile) {
    sets.push("profile_json = @profile_json");
    vals.profile_json = JSON.stringify(profile);
  }
  for (const [k, v] of Object.entries(cols)) {
    if (!/^[a-z_]+$/.test(k)) continue;
    sets.push(`${k} = @${k}`);
    vals[k] = v;
  }
  db.prepare(`UPDATE businesses SET ${sets.join(", ")} WHERE id = @id`).run(vals);
}

// For API routes: returns the signed-in user's business, or null (caller sends 401).
export async function apiBusiness(): Promise<Business | null> {
  const u = await currentUser();
  return u ? businessFor(u.id) : null;
}

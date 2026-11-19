import { checkPassword, endSession, startSession } from "@/lib/auth";
import { fail, json } from "@/lib/http";

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as Record<string, string>;
  const user = email && password ? await checkPassword(email, password) : null;
  if (!user) return fail("That email and password don't match.", 401);
  await startSession(user.id);
  return json({ ok: true });
}

export async function DELETE() {
  await endSession();
  return json({ ok: true });
}

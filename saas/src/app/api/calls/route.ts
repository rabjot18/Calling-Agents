import { db } from "@/lib/db";
import { listCalls, syncCalls } from "@/lib/calls";
import { json, withBusiness } from "@/lib/http";

// GET: calls for the dashboard. POST: pull new calls from Retell. PATCH: mark a call done / not done.
export const GET = withBusiness(async (b) => json({ calls: listCalls(b.id) }));

export const POST = withBusiness(async (b) => {
  const added = await syncCalls(b);
  return json({ added, calls: listCalls(b.id) });
});

export const PATCH = withBusiness(async (b, req) => {
  const { id, done } = (await req.json()) as { id: string; done: boolean };
  db.prepare("UPDATE calls SET done = ? WHERE id = ? AND business_id = ?").run(done ? 1 : 0, id, b.id);
  return json({ ok: true });
});

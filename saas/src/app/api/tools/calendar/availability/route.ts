import { checkAvailability } from "@/lib/calendar-tools";
import { readToolCall } from "../shared";

// check_availability for Retell: open times inside opening hours that don't clash with the owner's calendar.
export async function POST(req: Request) {
  const t = await readToolCall(req);
  if (t instanceof Response) return t;
  return Response.json(await checkAvailability(t));
}

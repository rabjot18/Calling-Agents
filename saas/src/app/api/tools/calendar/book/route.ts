import { bookAppointment } from "@/lib/calendar-tools";
import { readToolCall } from "../shared";

// book_appointment for Retell: re-checks the slot, then writes it to the connected calendar.
export async function POST(req: Request) {
  const t = await readToolCall(req);
  if (t instanceof Response) return t;
  return Response.json(await bookAppointment(t));
}

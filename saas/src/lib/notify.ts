import "server-only";
import type { Business } from "./auth";
import { emailCall } from "./email";
import { whatsappCall } from "./whatsapp";

// Everything that tells the owner about a finished call. Each channel guards itself (once per call, recent only, never throws).
export async function notifyCall(b: Business, callId: string) {
  const [email, whatsapp] = await Promise.all([emailCall(b, callId), whatsappCall(b, callId)]);
  return { email, whatsapp };
}

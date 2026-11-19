import type { CallRow } from "./calls";

// Display helpers shared by server pages and client components.
export const fmtTime = (ms: number, timeZone?: string) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone }).replace(" AM", " am").replace(" PM", " pm");
// Clock time without am/pm, for rows that already sit under an hour label.
export const fmtClock = (ms: number, timeZone?: string) => fmtTime(ms, timeZone).replace(/\s?[ap]m$/, "");
export const fmtDur = (ms: number | null) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}` : "");
export const fmtPhone = (n: string | null) => {
  if (!n) return n;
  const m = n.replace(/[^\d+]/g, "").match(/^\+?1?(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n;
};
export const relDay = (ms: number, timeZone?: string) => {
  const d = (x: number) => new Date(x).toLocaleDateString("en-CA", { timeZone });
  const now = Date.now();
  if (d(ms) === d(now)) return "Today";
  if (d(ms) === d(now - 86400000)) return "Yesterday";
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
};
export const tagOf = (c: CallRow) => (c.urgency === "urgent" ? { cls: "tag-urgent", label: "Urgent" } : { cls: `tag-${c.outcome.split(" ")[0]}`, label: c.outcome });
export const who = (c: CallRow) => c.caller_name || fmtPhone(c.from_number) || (c.call_type === "web_call" ? "Test call (browser)" : "Unknown caller");

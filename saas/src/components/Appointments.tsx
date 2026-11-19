"use client";
// Appointments: booking requests filed under the day the caller asked for, earliest first.
// Each one can be called back and ticked off as confirmed; the tick draws in and can be undone.
import type { CallRow } from "@/lib/calls";
import { fmtPhone, relDay, tagOf, who } from "@/lib/callview";
import { PhoneIcon } from "./ui";
import { TickBox, UndoBar, useTriage } from "./Desk";

export type ApptGroup = { key: string; label: string; sub?: string; items: { c: CallRow; time: string | null }[] };

export function AppointmentBook({ groups, timezone }: { groups: ApptGroup[]; timezone: string }) {
  const triage = useTriage("confirmed");
  if (!groups.length)
    return (
      <div className="sheet px-5 py-8 max-w-[760px]">
        <p className="h3">No booking requests yet</p>
        <p className="small mt-1">When a caller asks for an appointment, it lands here under the day they asked for.</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-7 max-w-[820px]">
      {groups.map((g) => {
        const open = g.items.filter(({ c }) => !triage.isTicked(c)).length;
        return (
          <section key={g.key} aria-label={g.label}>
            <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-[var(--rule-strong)]">
              <h2 className="cond text-[22px] font-bold leading-tight">{g.label}{g.sub && <span className="small !text-[14px] font-normal ml-2" style={{ fontStretch: "100%" }}>{g.sub}</span>}</h2>
              <span className="small">{open ? `${open} to confirm` : "All confirmed"}</span>
            </div>
            <ul className="ruled sheet !rounded-t-none !border-t-0">
              {g.items.map(({ c, time }) => {
                const ok = triage.isTicked(c);
                const t = tagOf(c);
                return (
                  <li key={c.id} className={`appt ${ok ? "ok struck" : ""}`}>
                    <span className="when">{time ?? <span className="text-[var(--faint)] text-[14px] font-semibold">Time open</span>}</span>
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2 min-w-0">
                        <span className="who font-semibold truncate">{who(c)}</span>
                        <span className={`tag ${ok ? "tag-Booked" : t.cls}`}>{ok ? "Confirmed" : t.label === "Booked" ? "Booked" : "Asked"}</span>
                      </span>
                      <span className="why block text-[14px] text-[var(--muted)] truncate">
                        {[c.service, c.appointment_time].filter(Boolean).join(", ") || c.reason || "No details yet"}. Called {relDay(c.started_at, timezone).toLowerCase()}.
                      </span>
                    </span>
                    <span className="acts">
                      {c.from_number && (
                        <a href={`tel:${c.from_number}`} className="btn btn-soft !min-h-[34px] !px-3 !text-[14px]" aria-label={`Call ${who(c)} back on ${fmtPhone(c.from_number)}`}>
                          <PhoneIcon />Call
                        </a>
                      )}
                      <TickBox on={ok} onToggle={() => triage.mark(c, !ok)} label={ok ? `${who(c)} confirmed. Untick to reopen` : `Mark ${who(c)} confirmed`} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <UndoBar toast={triage.toast} onUndo={triage.undo} onClose={triage.dismiss} />
    </div>
  );
}

// Business profile: everything the receptionist knows. Stored as JSON on the business row.

export type BusinessType =
  | "restaurant"
  | "salon"
  | "clinic"
  | "dental"
  | "law"
  | "home"
  | "store"
  | "other";

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAYS: { id: Day; label: string }[] = [
  { id: "mon", label: "Monday" },
  { id: "tue", label: "Tuesday" },
  { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" },
  { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" },
];

export type DayHours = { open: string; close: string } | null; // "09:00" 24h, null = closed

export type CatalogItem = {
  id: string;
  name: string;
  category?: string;
  price?: string; // as written, e.g. "$65", "from $250", "$100 / person"
  durationMin?: number | null; // services only
  description?: string;
  consult?: boolean; // needs a consultation before booking
  dietary?: string[]; // menu only: vegetarian, vegan, gluten-free…
  staff?: string; // who performs it
};

export type CallerNeed = "booking" | "orders" | "reservations" | "quotes" | "messages";

export type Profile = {
  name: string;
  type: BusinessType;
  website?: string;
  address?: string;
  phone?: string;
  timezone: string;
  hours: Record<Day, DayHours>;
  holidays?: string;
  callerNeeds: CallerNeed[];
  catalog: CatalogItem[];
  staff: { name: string; role?: string }[];
  answers: Record<string, string | string[] | boolean>;
  transfer: { rule: "insist" | "always" | "never"; number?: string };
  notifyEmail?: string;
  notifyWhatsApp?: string; // E.164; WhatsApp call summaries + transfer alerts
  extra: string[]; // free-form facts and "teach Maya" instructions, newest last
  receptionist: { name: string; voiceId?: string; voiceLabel?: string };
};

export function emptyProfile(): Profile {
  const closed = null;
  const nineToSix = { open: "09:00", close: "18:00" };
  return {
    name: "",
    type: "other",
    timezone: "America/New_York",
    hours: { mon: nineToSix, tue: nineToSix, wed: nineToSix, thu: nineToSix, fri: nineToSix, sat: closed, sun: closed },
    callerNeeds: ["messages"],
    catalog: [],
    staff: [],
    answers: {},
    transfer: { rule: "insist" },
    extra: [],
    receptionist: { name: "Maya" },
  };
}

export function parseProfile(json: string | null | undefined): Profile {
  const base = emptyProfile();
  if (!json) return base;
  try {
    const p = JSON.parse(json) as Partial<Profile>;
    return { ...base, ...p, hours: { ...base.hours, ...(p.hours ?? {}) }, receptionist: { ...base.receptionist, ...(p.receptionist ?? {}) } };
  } catch {
    return base;
  }
}

export function formatHours(h: Record<Day, DayHours>): string {
  const fmt = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    const ap = hh >= 12 ? "pm" : "am";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return mm ? `${h12}:${String(mm).padStart(2, "0")} ${ap}` : `${h12} ${ap}`;
  };
  return DAYS.map((d) => `${d.label}: ${h[d.id] ? `${fmt(h[d.id]!.open)} to ${fmt(h[d.id]!.close)}` : "closed"}`).join("; ");
}

export const catalogNoun = (t: BusinessType) => (t === "restaurant" ? "menu" : t === "law" ? "practice areas" : t === "store" ? "products" : "services");

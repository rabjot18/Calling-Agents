// Onboarding interview: question packs per business type. Pure functions, used on server and client.
import { catalogNoun, type BusinessType, type CallerNeed, type CatalogItem, type Profile } from "./profile";

export type QuestionKind = "upload" | "choice" | "multi" | "text" | "yesno" | "staff" | "phone" | "email";
export type Question = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  help?: string;
  options?: string[];
  suggested?: string;
  optional?: boolean;
};
export type Answer = string | string[] | boolean;

export const BUSINESS_TYPES: { id: BusinessType; label: string; needs: CallerNeed[] }[] = [
  { id: "restaurant", label: "Restaurant or café", needs: ["reservations", "messages"] },
  { id: "salon", label: "Hair or beauty salon", needs: ["booking", "messages"] },
  { id: "clinic", label: "Clinic or medical", needs: ["booking", "messages"] },
  { id: "dental", label: "Dental", needs: ["booking", "messages"] },
  { id: "law", label: "Law firm", needs: ["booking", "messages"] },
  { id: "home", label: "Home services", needs: ["quotes", "booking", "messages"] },
  { id: "store", label: "Online store", needs: ["orders", "messages"] },
  { id: "other", label: "Something else", needs: ["messages"] },
];

const DURATIONS: Record<string, number> = {
  "15 min": 15, "30 min": 30, "45 min": 45, "1 hour": 60, "1.5 hours": 90, "2 hours": 120, "3 hours": 180, "4+ hours": 240,
};
const usesDurations = (t: BusinessType) => ["salon", "clinic", "dental"].includes(t);
const hasCatalog = (t: BusinessType) => t !== "store";

function packFor(p: Profile): Question[] {
  const t = p.type;
  const items = p.catalog;
  const names = items.map((i) => i.name).slice(0, 24);
  const q: Question[] = [];

  // Ask while the list is empty; keep the question (for the chat history) once it has been answered.
  if (hasCatalog(t) && (items.length === 0 || "catalog" in p.answers)) {
    q.push({
      id: "catalog",
      kind: "upload",
      prompt:
        t === "restaurant"
          ? "Let's start with your menu. Upload a photo or PDF, or paste it, and I'll read every item and price."
          : t === "law"
            ? "What areas of law do you handle? Upload a list or paste them."
            : `What ${catalogNoun(t)} do you offer? Upload your price list (photo or PDF) or paste it, and I'll read every one.`,
      help: "A phone photo of a printed menu or price list works fine.",
    });
  }

  if (t === "restaurant") {
    if (items.length) {
      q.push({ id: "veg", kind: "multi", prompt: "Which dishes are vegetarian?", options: names, optional: true });
      q.push({ id: "gf", kind: "multi", prompt: "And which can be made gluten-free?", options: names, optional: true });
    }
    q.push({ id: "reservations", kind: "choice", prompt: "Do you take reservations?", options: ["Yes, by phone", "Yes, online only", "Walk-ins only"] });
    if (p.answers.reservations === "Yes, by phone")
      q.push({ id: "res_rules", kind: "text", prompt: "Anything I should know when booking a table?", suggested: "Up to 8 people, up to 30 days ahead", help: "Largest party, how far ahead, deposits, patio…" });
    q.push({ id: "takeout", kind: "choice", prompt: "Takeout and delivery?", options: ["Pickup and delivery", "Pickup only", "Delivery apps only", "Neither"] });
    if (String(p.answers.takeout ?? "").startsWith("Pickup"))
      q.push({ id: "phone_orders", kind: "yesno", prompt: "Should I take pickup orders over the phone?" });
    q.push({ id: "allergy", kind: "choice", prompt: "When someone asks about allergies, what should I do?", options: ["Answer from the menu, and suggest they tell staff", "Always pass it to staff"] });
  }

  if (usesDurations(t) && items.length) {
    const noDur = items.filter((i) => !i.durationMin);
    noDur.slice(0, 8).forEach((i) =>
      q.push({ id: `dur:${i.id}`, kind: "choice", prompt: `How long does "${i.name}" take?`, options: Object.keys(DURATIONS) })
    );
    if (noDur.length > 8) q.push({ id: "dur:rest", kind: "choice", prompt: `${noDur.length - 8} more have no length. What should I assume for those?`, options: Object.keys(DURATIONS) });
    items.filter((i) => !i.price).slice(0, 5).forEach((i) =>
      q.push({ id: `price:${i.id}`, kind: "text", prompt: `What's the starting price for "${i.name}"?`, suggested: "", help: "Say \"no price\" if I shouldn't quote one.", optional: true })
    );
    q.push({ id: "consult", kind: "multi", prompt: "Which of these need a consultation before someone can book?", options: names, optional: true });
  }

  if (t === "salon") {
    q.push({ id: "staff", kind: "staff", prompt: "Who works there? Add each stylist, and their level if prices differ (e.g. senior, junior)." });
    q.push({ id: "price_by_stylist", kind: "yesno", prompt: "Do prices change depending on the stylist?" });
    q.push({ id: "patch_test", kind: "yesno", prompt: "Do new colour clients need a patch test first?" });
    q.push({ id: "cancellation", kind: "text", prompt: "What's your cancellation policy?", suggested: "24 hours' notice" });
    q.push({ id: "deposit", kind: "choice", prompt: "Do you take deposits?", options: ["No deposits", "Only for long colour or bridal", "For every booking"] });
  }
  if (t === "clinic" || t === "dental") {
    q.push({ id: "staff", kind: "staff", prompt: "Who sees patients? Add each practitioner and what they do.", optional: true });
    q.push({ id: "new_patients", kind: "yesno", prompt: "Are you taking new patients?" });
    q.push({ id: "insurance", kind: "text", prompt: "Which insurance or direct billing do you accept?", suggested: "Most major plans; we bill directly", optional: true });
    q.push({ id: "intake", kind: "text", prompt: "What should I collect from a new patient?", suggested: "Full name, date of birth, phone, reason for visit" });
    q.push({
      id: "urgent",
      kind: "choice",
      prompt: t === "dental" ? "If someone has severe pain or swelling, what should I do?" : "If someone describes an urgent symptom, what should I do?",
      options: ["Tell them to call 911 if it's an emergency, then take an urgent message", "Transfer them to the clinic right away", "Offer the next same-day appointment"],
    });
    q.push({ id: "cancellation", kind: "text", prompt: "What's your cancellation policy?", suggested: "24 hours' notice" });
  }
  if (t === "law") {
    q.push({ id: "consult_fee", kind: "choice", prompt: "Is the first consultation free?", options: ["Yes, free", "Paid consultation", "Depends on the matter"] });
    q.push({ id: "intake", kind: "text", prompt: "What should I collect from a new client?", suggested: "Name, phone, email, the other party's name (for a conflict check), a short description of the matter" });
    q.push({ id: "urgent", kind: "choice", prompt: "If someone has an urgent legal matter (an arrest, a court date tomorrow)…", options: ["Transfer to a lawyer right away", "Take an urgent message"] });
  }
  if (t === "home") {
    q.push({ id: "area", kind: "text", prompt: "Which areas do you serve?", suggested: "", help: "Towns, postal codes, or a radius" });
    q.push({ id: "emergency", kind: "choice", prompt: "Do you take emergency calls (burst pipe, no heat)?", options: ["Yes, 24/7, transfer them", "Yes, during hours only", "No emergencies"] });
    q.push({ id: "quotes", kind: "choice", prompt: "How do quotes work?", options: ["Free quote on site", "Paid call-out fee", "Quote by phone or photos"] });
  }
  if (t === "store") {
    q.push({ id: "platform", kind: "choice", prompt: "Where do you sell?", options: ["Shopify", "WooCommerce", "Etsy", "Something else"] });
    q.push({ id: "returns", kind: "text", prompt: "What's your return policy?", suggested: "Returns within 30 days, unused, with receipt" });
    q.push({ id: "shipping", kind: "text", prompt: "How long does shipping usually take?", suggested: "3–5 business days" });
  }
  if (t === "other") q.push({ id: "main_reason", kind: "text", prompt: "What do most people call you about?" });

  return q;
}

function commonEnd(p: Profile): Question[] {
  const q: Question[] = [
    { id: "transfer_rule", kind: "choice", prompt: "If a caller asks for a real person, what should happen?", options: ["Offer a message first, transfer if they insist", "Transfer right away", "Never transfer, always take a message"] },
  ];
  if (p.transfer.rule !== "never") q.push({ id: "transfer_number", kind: "phone", prompt: "Which number should I transfer calls to?", help: "Only used during your opening hours." });
  q.push({ id: "notify_email", kind: "email", prompt: "Where should I send call summaries and messages?" });
  q.push({ id: "extra", kind: "text", prompt: "Anything else I should know? Things you'd tell a new receptionist on day one.", optional: true, help: "Parking, staff days off, what never to promise…" });
  return q;
}

// "902-555-0143" / "(902) 555 0143" / "+44 20 7946 0958" -> E.164. North American numbers default to +1.
export function toE164(raw: string): string | null {
  const t = raw.trim();
  const digits = t.replace(/\D/g, "");
  if (t.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function questions(p: Profile): Question[] {
  return [...packFor(p), ...commonEnd(p)];
}

export function nextQuestion(p: Profile): Question | null {
  return questions(p).find((q) => !(q.id in p.answers)) ?? null;
}

export function progress(p: Profile) {
  const all = questions(p);
  const done = all.filter((q) => q.id in p.answers).length;
  return { done, total: all.length };
}

// Records an answer and applies it to the structured profile. Returns a new profile.
export function applyAnswer(p0: Profile, q: Question, a: Answer): Profile {
  const p: Profile = structuredClone(p0);
  p.answers[q.id] = a;
  const setItem = (id: string, f: (i: CatalogItem) => void) => p.catalog.forEach((i) => i.id === id && f(i));
  const [kind, itemId] = q.id.split(":");

  if (kind === "dur" && typeof a === "string") {
    const m = DURATIONS[a] ?? null;
    if (itemId === "rest") p.catalog.forEach((i) => { if (!i.durationMin) i.durationMin = m; });
    else setItem(itemId, (i) => (i.durationMin = m));
  } else if (kind === "price" && typeof a === "string" && /\d|free/i.test(a) && a.length < 40 && !/no price/i.test(a)) {
    setItem(itemId, (i) => (i.price = a.trim()));
  } else if (q.id === "consult" && Array.isArray(a)) {
    p.catalog.forEach((i) => (i.consult = a.includes(i.name)));
  } else if ((q.id === "veg" || q.id === "gf") && Array.isArray(a)) {
    const tag = q.id === "veg" ? "vegetarian" : "gluten-free option";
    p.catalog.forEach((i) => {
      const d = new Set(i.dietary ?? []);
      if (a.includes(i.name)) d.add(tag); else d.delete(tag);
      i.dietary = [...d];
    });
  } else if (q.id === "staff" && Array.isArray(a)) {
    p.staff = a.filter(Boolean).map((s) => {
      const [name, role] = s.split(/\s*[,–-]\s*/, 2);
      return { name: name.trim(), role: role?.trim() };
    });
  } else if (q.id === "transfer_rule" && typeof a === "string") {
    p.transfer.rule = a.startsWith("Never") ? "never" : a.startsWith("Transfer right") ? "always" : "insist";
  } else if (q.id === "transfer_number" && typeof a === "string") {
    p.transfer.number = toE164(a) ?? a.trim();
  } else if (q.id === "notify_email" && typeof a === "string") {
    p.notifyEmail = a.trim();
  } else if (q.id === "extra" && typeof a === "string" && a.trim()) {
    p.extra = [...p.extra, a.trim()];
  }
  return p;
}

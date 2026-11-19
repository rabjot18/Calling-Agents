import { businessFor, saveBusiness } from "@/lib/auth";
import { aiAvailable, profileFromWebsite } from "@/lib/ai";
import { fail, json, publicBusiness, withBusiness } from "@/lib/http";
import type { Day } from "@/lib/profile";
import { readWebsite } from "@/lib/scrape";
import { rebuildAgent } from "@/lib/agent";

// Reads the business website and pre-fills the profile, so the owner only fills gaps.
export const POST = withBusiness(async (b, req) => {
  const { url, name } = (await req.json()) as { url?: string; name?: string };
  const p = { ...b.profile, name: name?.trim() || b.profile.name };
  const found: string[] = [];
  if (url?.trim()) {
    if (!aiAvailable()) return fail("Website import needs the AI key set up. Type your details in for now.", 503);
    const site = await readWebsite(url.trim());
    if (!site) return fail("I couldn't open that website. Check the address, or skip this step and upload your menu or price list instead.");
    const s = await profileFromWebsite(site.url, site.text);
    if (s) {
      p.website = site.url;
      if (s.name && !name) p.name = s.name;
      if (s.address) { p.address = s.address; found.push("address"); }
      if (s.phone) { p.phone = s.phone; found.push("phone"); }
      if (s.hours.length) {
        for (const h of s.hours) p.hours[h.day as Day] = h.open && h.close ? { open: h.open, close: h.close } : null;
        found.push("hours");
      }
      if (s.items.length) {
        p.catalog = s.items;
        const noun = s.business_type === "restaurant" ? "menu items" : s.business_type === "store" ? "products" : "services";
        const priced = s.items.filter((i) => i.price).length;
        found.push(priced === s.items.length ? `${s.items.length} ${noun} with prices` : `${s.items.length} ${noun} (${priced} with prices)`);
      }
      if (s.facts.length) p.extra = [...new Set([...p.extra, ...s.facts])];
      p.type = s.business_type;
    }
  }
  saveBusiness(b.id, { profile: p });
  // If the receptionist already exists (re-import from settings or going back), give it what was just read.
  await rebuildAgent(b.user_id).catch((e) => console.error("agent refresh after website import failed:", e instanceof Error ? e.message : e));
  return json({ ...publicBusiness(businessFor(b.user_id)), found });
});

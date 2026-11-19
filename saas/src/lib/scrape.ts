import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Reads a business website as plain text for the AI to pull a profile from.
// Pass 1: plain HTTP with a real browser's identity; keeps structured data (JSON-LD, Next.js page data) and follows
//         up to 6 same-site pages that look like menus, services, prices, hours, booking or FAQ.
// Pass 2: when pass 1 is thin or shows no prices (JavaScript-built sites like Domino's, Wix, shops, ordering sites), render the
//         site in headless Chromium, read the visible text, and visit up to 5 menu/service pages the same way.
// Only public http(s) hosts; redirects to private ranges are refused in both passes.

const PRIVATE = /^(localhost|0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|\[?::1\]?|\[?f[cd])/i;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
// Pages that usually hold the catalogue come first; the rest fill remaining slots.
const STRONG = /menu|shop|store\b|products?|collections?|catalog|services?\b|prices?|pricing|rates?\b|treatments?|packages?|plans?\b|categor|gift|hamper|specials|catering|order/i;
const USEFUL = /hours|about|contact|book|appointment|faq|our-work|what-we-do|locations?|store-locator|visit/i;
const SKIP = /terms|privacy|polic|refund|return|shipping|cookie|login|sign-?in|sign-?up|register|account|cart|checkout|wishlist|careers|jobs|blog|news|press|legal|disclaimer|sitemap/i;
const MAX_TEXT = 150_000;

// Prices in any common currency: $12, ₹ 1260, Rs. 500, €9, 12.50 USD.
const PRICE = /(?:[$€£₹¥]|\bRs\.?|\bINR\b|\bUSD\b|\bCAD\b|\bAUD\b|\bAED\b)\s?\d|\d(?:[.,]\d{2})?\s?(?:USD|CAD|EUR|GBP|INR|AED)\b/g;
export const priceCount = (text: string) => (text.match(PRICE) ?? []).length;

export function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(u.protocol) || PRIVATE.test(u.hostname) || !u.hostname.includes(".")) return null;
    return u;
  } catch {
    return null;
  }
}
const sameSite = (a: URL, b: URL) => a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");

async function get(u: URL, hops = 0): Promise<{ html: string; url: URL } | null> {
  const res = await fetch(u, {
    redirect: "manual",
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-CA,en;q=0.9" },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status >= 300 && res.status < 400) {
    const next = res.headers.get("location");
    const nu = next && hops < 5 ? safeUrl(new URL(next, u).toString()) : null;
    return nu ? get(nu, hops + 1) : null;
  }
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
  return { html: (await res.text()).slice(0, 3_000_000), url: u };
}

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;|&#8217;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&#36;/g, "$").replace(/&ndash;|&mdash;/g, "–");

// Structured data survives even on JavaScript-built pages: schema.org JSON-LD (hours, menus, services) and Next.js page props.
function structured(html: string): string {
  const out: string[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) out.push(m[1].trim().slice(0, 30_000));
  const next = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next) out.push(next[1].replace(/"[A-Za-z0-9+/=]{200,}"/g, '""').slice(0, 40_000));
  const meta = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description|og:title)["'][^>]+content=["']([^"']+)["']/gi)].map((m) => decode(m[1]));
  return [meta.join("\n"), out.length ? `Structured data:\n${out.join("\n")}` : ""].filter(Boolean).join("\n");
}

const toText = (html: string) =>
  decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section|article|dt|dd)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

// Same-site links worth reading, judged by both the path and the visible link text.
function usefulLinks(html: string, base: URL, limit: number): URL[] {
  const strong: URL[] = [];
  const other: URL[] = [];
  const seen = new Set([base.pathname]);
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let l: URL;
    try { l = new URL(m[1], base); } catch { continue; }
    if (!sameSite(l, base) || !/^https?:$/.test(l.protocol) || /\.(pdf|jpe?g|png|webp|zip)$/i.test(l.pathname)) continue;
    const label = m[2].replace(/<[^>]+>/g, " ");
    if (SKIP.test(l.pathname) || seen.has(l.pathname)) continue;
    const isStrong = STRONG.test(l.pathname) || STRONG.test(label);
    if (!isStrong && !USEFUL.test(l.pathname) && !USEFUL.test(label)) continue;
    l.hash = "";
    seen.add(l.pathname);
    (isStrong ? strong : other).push(l);
  }
  return [...strong, ...other].slice(0, limit);
}

// Background data a page loads (menus and product lists often come from a JSON API, sometimes a third-party one).
// Kept only when it looks like a catalogue: has a name and a price-like field. Long URLs and blobs are dropped.
const CATALOG_JSON = /"(?:price|prices|amount|cost|sale_?price|mrp|regular_?price|base_?price)"\s*:/i;
const compactJson = (body: string) =>
  body.replace(/"https?:\/\/[^"]{20,}"/g, '""').replace(/"[A-Za-z0-9+/=]{120,}"/g, '""').replace(/\s+/g, " ").slice(0, 40_000);

// Worth opening in a real browser: little text, or no prices anywhere (catalogue drawn by JavaScript).
// Marks category tabs in the page with data-pulse-tab="i" and returns how many. Plain JavaScript in a string so no
// build tool can rewrite it (bundler helpers don't exist inside the page).
const TAB_SCAN = `(() => {
  var bad = /cart|log ?in|sign|search|close|subscribe|send|submit|add\\b|cookie|accept|buy|checkout|wishlist|share|next|prev|account|menu$/i;
  function ok(el) {
    var t = (el.innerText || "").trim();
    if (t.length < 2 || t.length > 32 || t.indexOf("\\n") >= 0 || bad.test(t)) return false;
    var a = el.closest("a"), h = a && a.getAttribute("href");
    if (h && !/^(#|javascript:)/.test(h)) return false;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    return el.getAttribute("role") === "tab" || el.tagName === "BUTTON" || getComputedStyle(el).cursor === "pointer";
  }
  var picked = [], all = document.querySelectorAll("body *");
  for (var i = 0; i < all.length && picked.length < 30; i++) {
    var el = all[i];
    if (!ok(el) || picked.some(function (p) { return p.contains(el) || el.contains(p); })) continue;
    var sibs = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, ok) : [];
    if (sibs.length >= 3) picked.push(el);
  }
  picked.forEach(function (el, i) { el.setAttribute("data-pulse-tab", String(i)); });
  return picked.length;
})()`;

const needsBrowser = (text: string) => text.replace(/\s+/g, " ").length < 2500 || priceCount(text) < 5;

// ───────── pass 2: headless browser ─────────
function browserPath(): string | null {
  const home = os.homedir();
  const pw = path.join(home, "Library/Caches/ms-playwright");
  const candidates = [
    process.env.BROWSER_PATH,
    ...(fs.existsSync(pw)
      ? fs.readdirSync(pw).flatMap((d) => [
          path.join(pw, d, "chrome-headless-shell-mac-arm64/chrome-headless-shell"),
          path.join(pw, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
          path.join(pw, d, "chrome-linux/headless_shell"),
          path.join(pw, d, "chrome-linux/chrome"),
        ])
      : []),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

async function render(start: URL): Promise<string | null> {
  const exe = browserPath();
  if (!exe) return null;
  const deadline = Date.now() + 80_000;
  const left = () => deadline - Date.now();
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 }, locale: "en-CA" });
    // Never let a rendered page reach private networks; skip heavy media for speed.
    await ctx.route("**/*", (route) => {
      const r = route.request();
      let host = "";
      try { host = new URL(r.url()).hostname; } catch {}
      if (PRIVATE.test(host)) return route.abort();
      if (["image", "media", "font"].includes(r.resourceType())) return route.abort();
      return route.continue();
    });
    const page = await ctx.newPage();

    const feeds: string[] = [];
    const feedUrls = new Set<string>();
    let feedChars = 0;
    page.on("response", async (res) => {
      try {
        if (!(res.headers()["content-type"] ?? "").includes("json") || feedUrls.has(res.url()) || feedChars > 120_000) return;
        const body = await res.text();
        if (!CATALOG_JSON.test(body) || !/"(?:name|title|item_?name|product_?name)"\s*:/i.test(body)) return;
        feedUrls.add(res.url());
        const c = compactJson(body);
        feedChars += c.length;
        feeds.push(c);
      } catch {}
    });

    const settle = (ms: number) => page.waitForLoadState("networkidle", { timeout: Math.max(500, Math.min(ms, left())) }).catch(() => {});
    const scroll = () =>
      page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight && y < 20000; y += 900) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      }).catch(() => {});
    const bodyText = () => page.evaluate(() => document.body?.innerText ?? "").catch(() => "");

    // Category tabs (Starters / Mains, Labon / Baklava, Cuts / Colour): short clickable labels that sit in a row of
    // three or more siblings and don't go to another page. Click each and keep any new text it reveals.
    const tabs = async (seen: Set<string>, budget: number): Promise<string> => {
      const count = await page.evaluate<number>(TAB_SCAN).catch(() => 0);
      const out: string[] = [];
      const here = page.url();
      for (let i = 0; i < Math.min(count, budget) && left() > 8_000; i++) {
        try {
          await page.locator(`[data-pulse-tab="${i}"]`).first().click({ timeout: 2_000 });
          await settle(3_000);
          const fresh = (await bodyText()).split("\n").map((l) => l.trim()).filter((l) => l && !seen.has(l));
          fresh.forEach((l) => seen.add(l));
          if (fresh.length) out.push(fresh.join("\n"));
          if (page.url() !== here) await page.goto(here, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
        } catch {}
      }
      return out.join("\n");
    };

    let tabBudget = 24;
    const read = async (u: URL) => {
      await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: Math.min(20_000, left()) });
      await settle(8_000);
      await scroll();
      const text = await bodyText();
      const html = await page.content().catch(() => "");
      let more = "";
      // Only dig into tabs where a catalogue is likely: prices on the page, or a menu/shop/services address.
      if (tabBudget > 0 && left() > 15_000 && (priceCount(text) > 0 || STRONG.test(u.pathname))) {
        const seen = new Set(text.split("\n").map((l) => l.trim()));
        more = await tabs(seen, tabBudget);
        tabBudget -= 12;
      }
      return { text: more ? `${text}\n${more}` : text, html };
    };

    const home = await read(start);
    const parts = [`Page: ${start}\n${structured(home.html)}\n${home.text}`];
    for (const l of usefulLinks(home.html, start, 6)) {
      if (left() < 10_000) break;
      try {
        const p = await read(l);
        if (p.text.trim()) parts.push(`Page: ${l}\n${structured(p.html)}\n${p.text}`);
      } catch {}
    }
    if (feeds.length) parts.push(`Catalogue data the site loaded:\n${feeds.join("\n")}`);
    return parts.join("\n\n---\n\n");
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function readWebsite(raw: string): Promise<{ url: string; text: string; via: "page" | "browser" } | null> {
  const u = safeUrl(raw);
  if (!u) return null;
  let text = "";
  let finalUrl = u;
  const home = await get(u).catch(() => null);
  if (home) {
    finalUrl = home.url;
    const links = usefulLinks(home.html, home.url, 8);
    const pages = (await Promise.all(links.map((l) => get(l).catch(() => null)))).filter(Boolean) as { html: string; url: URL }[];
    text = [home, ...pages].map((p) => `Page: ${p.url}\n${structured(p.html)}\n${toText(p.html)}`).join("\n\n---\n\n");
  }
  if (!needsBrowser(text)) return { url: finalUrl.toString(), text: text.slice(0, MAX_TEXT), via: "page" };
  const rendered = await render(finalUrl).catch((e) => {
    console.error("website render failed:", e instanceof Error ? e.message.split("\n")[0] : e);
    return null;
  });
  // Browser text first (it has what JavaScript drew), then anything the plain fetch saw that it didn't.
  if (rendered && (priceCount(rendered) > priceCount(text) || rendered.length > text.length)) {
    return { url: finalUrl.toString(), text: `${rendered}\n\n---\n\n${text}`.slice(0, MAX_TEXT), via: "browser" };
  }
  return text ? { url: finalUrl.toString(), text: text.slice(0, MAX_TEXT), via: "page" } : null;
}

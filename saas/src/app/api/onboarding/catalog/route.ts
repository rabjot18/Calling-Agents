import { businessFor, saveBusiness } from "@/lib/auth";
import { aiAvailable, extractCatalog } from "@/lib/ai";
import { rebuildAgent } from "@/lib/agent";
import { fail, json, publicBusiness, withBusiness } from "@/lib/http";
import { catalogNoun } from "@/lib/profile";

// Photos (incl. iPhone HEIC) and PDFs go to the AI as files; text-like files are read as text.
const FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif", "application/pdf"];
const TEXT_TYPES = ["text/plain", "text/csv", "text/markdown", "text/tab-separated-values", "application/json"];
const byExt: Record<string, string> = { heic: "image/heic", heif: "image/heif", txt: "text/plain", csv: "text/csv", md: "text/markdown", tsv: "text/tab-separated-values", pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MAX = 14 * 1024 * 1024; // base64 adds a third; Gemini caps inline requests at about 20 MB

// Reads an uploaded menu / price list (photo, PDF, text file or pasted text) into catalog items.
export const POST = withBusiness(async (b, req) => {
  if (!aiAvailable()) return fail("Reading menus needs the AI key set up. Add items by typing them for now.", 503);
  const form = await req.formData();
  const file = form.get("file");
  let text = String(form.get("text") ?? "").slice(0, 60000);
  let upload: { data: string; mediaType: string } | undefined;
  if (file instanceof File && file.size) {
    // Browsers often send HEIC or CSV with an empty or generic type; fall back to the extension.
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const type = FILE_TYPES.includes(file.type) || TEXT_TYPES.includes(file.type) ? file.type : byExt[ext] ?? file.type;
    if (/\.(docx?|xlsx?|pages|numbers|key|pptx?)$/i.test(file.name)) return fail("I can't open Word or Excel files yet. Save it as a PDF (File, Save as PDF) and upload that, or paste the text.");
    if (file.size > MAX) return fail("That file is over 14 MB. Try a smaller photo, or one page at a time.");
    if (TEXT_TYPES.includes(type)) text = `${text}\n${(await file.text()).slice(0, 60000)}`;
    else if (FILE_TYPES.includes(type)) upload = { data: Buffer.from(await file.arrayBuffer()).toString("base64"), mediaType: type };
    else return fail("Upload a photo, a PDF, or a text or CSV file.");
  }
  if (!upload && !text.trim()) return fail("Add a file or paste your list.");
  const items = await extractCatalog(catalogNoun(b.profile.type), { text, file: upload });
  if (!items.length) return fail("I couldn't find any items in that. Try a clearer photo, or paste the text.");
  const seen = new Set(b.profile.catalog.map((i) => i.name.toLowerCase()));
  const catalog = [...b.profile.catalog, ...items.filter((i) => !seen.has(i.name.toLowerCase()))];
  const profile = { ...b.profile, catalog, answers: { ...b.profile.answers, catalog: "uploaded" } };
  saveBusiness(b.id, { profile });
  // Keep the live receptionist in step with the new list.
  await rebuildAgent(b.user_id).catch((e) => console.error("agent refresh after catalog upload failed:", e instanceof Error ? e.message : e));
  return json({ ...publicBusiness(businessFor(b.user_id)), added: items.length });
});

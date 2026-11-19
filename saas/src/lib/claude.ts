import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { CatalogItem } from "./profile";

// Claude reads menus, price lists and websites into structured data.
const MODEL = "claude-opus-5-5";

export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);
const client = () => new Anthropic();

const ItemSchema = z.object({
  name: z.string(),
  category: z.string().nullable(),
  price: z.string().nullable().describe("Price exactly as written, e.g. \"$65\", \"from $250\", \"$100 / person\". null if not shown."),
  duration_min: z.number().nullable().describe("Length in minutes if stated (services only), else null."),
  description: z.string().nullable(),
  consult_required: z.boolean().describe("True only if the source says a consultation is required first."),
});
const CatalogSchema = z.object({ items: z.array(ItemSchema) });

const toItems = (items: z.infer<typeof ItemSchema>[]): CatalogItem[] =>
  items.map((i) => ({
    id: crypto.randomUUID().slice(0, 8),
    name: i.name.trim(),
    category: i.category ?? undefined,
    price: i.price ?? undefined,
    durationMin: i.duration_min ?? null,
    description: i.description ?? undefined,
    consult: i.consult_required || undefined,
  }));

type Upload = { data: string; mediaType: string }; // base64

export async function extractCatalog(kind: string, input: { text?: string; file?: Upload }): Promise<CatalogItem[]> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.file) {
    if (input.file.mediaType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.file.data } });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: input.file.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: input.file.data },
      });
    }
  }
  content.push({
    type: "text",
    text:
      `Extract every item from this business's ${kind}. One entry per orderable item or bookable service, ` +
      `keeping the business's own names and prices exactly as written. Don't invent prices, lengths or items.` +
      (input.text ? `\n\n<source>\n${input.text}\n</source>` : ""),
  });
  const res = await client().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(CatalogSchema), effort: "low" },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) return [];
  return toItems(res.parsed_output.items);
}

const SiteSchema = z.object({
  name: z.string().nullable(),
  business_type: z.enum(["restaurant", "salon", "clinic", "dental", "law", "home", "store", "other"]),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  hours: z
    .array(z.object({ day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]), open: z.string().nullable().describe("24h HH:MM or null if closed"), close: z.string().nullable() }))
    .describe("Only days actually stated on the site"),
  items: z.array(ItemSchema).describe("Menu items or services with prices, if the site lists them"),
  facts: z.array(z.string()).describe("Short facts a receptionist should know: parking, policies, payment, etc."),
});
export type SiteProfile = Omit<z.infer<typeof SiteSchema>, "items"> & { items: CatalogItem[] };

export async function profileFromWebsite(url: string, text: string): Promise<SiteProfile | null> {
  const res = await client().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(SiteSchema), effort: "low" },
    messages: [
      {
        role: "user",
        content:
          `This is text from the website ${url}. Pull out what a phone receptionist for this business needs. ` +
          `Only use what the text says; use null or empty lists for anything missing.\n\n<website>\n${text}\n</website>`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) return null;
  return { ...res.parsed_output, items: toItems(res.parsed_output.items) };
}

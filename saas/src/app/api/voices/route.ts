import { json, withBusiness } from "@/lib/http";
import { retell, type RetellVoice } from "@/lib/retell";
import { onVapi } from "@/lib/vapi";

let cache: { at: number; platform: string; voices: unknown[] } | null = null;

// On Vapi the receptionist speaks with ElevenLabs voices; ElevenLabs lists its standard voices (with previews) publicly.
type ElevenVoice = { voice_id: string; name: string; preview_url?: string; labels?: { gender?: string; accent?: string; age?: string } };
async function elevenVoices() {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { cache: "no-store" });
  if (!r.ok) throw new Error("Couldn't load voices right now.");
  const { voices } = (await r.json()) as { voices: ElevenVoice[] };
  return voices
    .filter((v) => v.preview_url && v.labels?.gender)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => ({
      id: `11labs:${v.voice_id}`,
      name: v.name.split(/\s+[-–]\s+/)[0],
      gender: (v.labels?.gender ?? "").toLowerCase(),
      accent: (v.labels?.accent ?? "").replace(/^./, (c) => c.toUpperCase()),
      age: (v.labels?.age ?? "").replace(/_/g, " "),
      provider: "elevenlabs",
      preview: v.preview_url,
    }));
}

// A curated, previewable voice list: every gender and accent Retell offers, platform voices first.
export const GET = withBusiness(async () => {
  const platform = onVapi() ? "vapi" : "retell";
  if (platform === "vapi" && (!cache || cache.platform !== "vapi" || Date.now() - cache.at > 3600_000)) {
    cache = { at: Date.now(), platform, voices: await elevenVoices() };
  }
  if (!cache || cache.platform !== platform || Date.now() - cache.at > 3600_000) {
    const all = await retell<RetellVoice[]>("GET", "/list-voices");
    const rank = (v: RetellVoice) => (v.provider === "platform" ? 0 : v.provider === "elevenlabs" ? 1 : v.provider === "cartesia" ? 2 : 3);
    const voices = all
      .filter((v) => v.preview_audio_url && v.gender)
      .sort((a, b) => rank(a) - rank(b) || a.voice_name.localeCompare(b.voice_name))
      .slice(0, 80)
      .map((v) => ({
        id: v.voice_id,
        name: v.voice_name.replace(/^retell-/i, ""),
        gender: (v.gender ?? "").toLowerCase(),
        accent: v.accent ?? "",
        age: v.age ?? "",
        provider: v.provider,
        preview: v.preview_audio_url,
      }));
    cache = { at: Date.now(), platform, voices };
  }
  return json({ voices: cache.voices });
});

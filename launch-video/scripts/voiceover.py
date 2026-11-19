# Generates the narrator lines with Gemini TTS (key read from saas/.env.local by the caller's env; never printed).
# One clip per line -> public/audio/vo/<id>.wav (silence trimmed), plus vo.json with measured durations.
# Run: set -a; source ../saas/.env.local; set +a; python3 scripts/voiceover.py
import os, json, base64, subprocess, urllib.request, urllib.error, sys, time
KEY = os.environ["GEMINI_API_KEY"]
OUT = "public/audio/vo"
VOICE = os.environ.get("VO_VOICE", "Puck")
MODELS = [os.environ.get("VO_MODEL", "gemini-3.8-flash-tts")]  # one model only, so the narrator sounds the same on every line
# No style preamble: the TTS models read instructions aloud. Character comes from the voice (VO_VOICE).
STYLE = ""
LINES = [
    ("v01", "You just missed a booking. A regular. A hundred and forty dollars."),
    ("v02", "Who answers when you're with a customer?"),
    ("v03", "Meet Pulse."),
    ("v04", "The AI receptionist for small business."),
    ("v05", "It answers every call,"),
    ("v06", "and writes each one straight into your day."),
    ("v07", "One number. Every caller. Maya answers them all."),
    ("v08", "And it knows what's urgent."),
    ("v09", "Every call is summarised and transcribed,"),
    ("v10", "and names are spelled back, letter by letter."),
    ("v11", "Thirty-eight calls. Fourteen bookings. All on autopilot."),
    ("v12", "Stop sending customers to voicemail."),
    ("v13", "Pulse. Answers, books, remembers."),
    ("v14", "Start answering every call today."),
]
if __name__ == "__main__":
    only = set(sys.argv[1:])
    meta = json.load(open(f"{OUT}/vo.json")) if os.path.exists(f"{OUT}/vo.json") else {}
    for lid, text in LINES:
        if only and lid not in only:
            continue
        body = {"contents": [{"role": "user", "parts": [{"text": text}]}],
                "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
        pcm = None
        for m in MODELS * 6:  # retry the same model on 429 with backoff
            try:
                r = urllib.request.urlopen(urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                    data=json.dumps(body).encode(), headers={"x-goog-api-key": KEY, "Content-Type": "application/json"}), timeout=120)
                d = json.load(r)
                part = next(p for p in d["candidates"][0]["content"]["parts"] if "inlineData" in p)
                pcm = base64.b64decode(part["inlineData"]["data"]); mime = part["inlineData"]["mimeType"]; used = m
                time.sleep(22)  # free tier allows only a few TTS requests per minute
                break
            except urllib.error.HTTPError as e:
                print(lid, m, "HTTP", e.code, "- waiting 20s"); time.sleep(20)
            except Exception as e:
                print(lid, m, type(e).__name__)
        if pcm is None:
            print(lid, "FAILED"); continue
        rate = int(mime.split("rate=")[1].split(";")[0]) if "rate=" in mime else 24000
        raw = f"{OUT}/{lid}.raw"; open(raw, "wb").write(pcm)
        # trim leading/trailing silence, keep 60ms of air at both ends
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", raw,
            "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse",
            f"{OUT}/{lid}.wav"], check=True)
        os.remove(raw)
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{OUT}/{lid}.wav"]).decode())
        meta[lid] = {"text": text, "model": used, "voice": VOICE, "seconds": round(dur, 3)}
        print(lid, used, f"{dur:.2f}s", text)
    json.dump(meta, open(f"{OUT}/vo.json", "w"), indent=2)

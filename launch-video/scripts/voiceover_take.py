# One-request narrator take (free tier = 10 TTS requests/day/model): all lines read in one go, then split at the
# N-1 longest pauses into public/audio/vo/<id>.wav (+ vo.json). Line list is shared with scripts/voiceover.py.
# Run: set -a; source ../saas/.env.local; set +a; python3 scripts/voiceover_take.py
import os, json, base64, subprocess, urllib.request, sys, re
sys.path.insert(0, os.path.dirname(__file__))
from voiceover import LINES, OUT  # noqa: E402  (imports only constants; generation there is guarded below)
KEY = os.environ["GEMINI_API_KEY"]
MODEL = os.environ.get("VO_MODEL", "gemini-2.5-flash-preview-tts")
VOICE = os.environ.get("VO_VOICE", "Puck")
script = "\n\n".join(t for _, t in LINES)
body = {"contents": [{"role": "user", "parts": [{"text": script}]}],
        "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
r = urllib.request.urlopen(urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
    data=json.dumps(body).encode(), headers={"x-goog-api-key": KEY, "Content-Type": "application/json"}), timeout=300)
part = next(p for p in json.load(r)["candidates"][0]["content"]["parts"] if "inlineData" in p)
rate = int(part["inlineData"]["mimeType"].split("rate=")[1].split(";")[0])
open(f"{OUT}/take.raw", "wb").write(base64.b64decode(part["inlineData"]["data"]))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", f"{OUT}/take.raw", f"{OUT}/take.wav"], check=True)
os.remove(f"{OUT}/take.raw")
# pauses
log = subprocess.run(["ffmpeg", "-i", f"{OUT}/take.wav", "-af", "silencedetect=noise=-40dB:d=0.18", "-f", "null", "-"], capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
total = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{OUT}/take.wav"]).decode())
gaps = [(e - s, s, e) for s, e in zip(starts, ends) if s > 0.05 and e < total - 0.05]
n = len(LINES)
cuts = sorted(sorted(gaps, reverse=True)[: n - 1], key=lambda g: g[1])
print(f"take {total:.2f}s, {len(gaps)} pauses, using {len(cuts)} longest:", [round(g[0], 2) for g in cuts])
bounds = [0.0] + [(s + e) / 2 for _, s, e in cuts] + [total]
meta = {}
for i, (lid, text) in enumerate(LINES):
    a, b = bounds[i], bounds[i + 1]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/take.wav", "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
        "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse",
        f"{OUT}/{lid}.wav"], check=True)
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{OUT}/{lid}.wav"]).decode())
    meta[lid] = {"text": text, "model": MODEL, "voice": VOICE, "seconds": round(d, 3)}
    print(lid, f"{d:.2f}s", text)
json.dump(meta, open(f"{OUT}/vo.json", "w"), indent=2)

# Splits public/audio/vo/take.wav into the 14 lines using Gemini (text model) line timestamps, snapped to real pauses.
import os, json, base64, subprocess, urllib.request, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from voiceover import LINES, OUT
KEY = os.environ["GEMINI_API_KEY"]
take = f"{OUT}/take.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", take, "-ac", "1", "-b:a", "64k", f"{OUT}/take.mp3"], check=True)
data = base64.b64encode(open(f"{OUT}/take.mp3", "rb").read()).decode()
numbered = "\n".join(f"{i+1}. {t}" for i, (_, t) in enumerate(LINES))
prompt = ("This audio is one narrator reading these lines in order:\n" + numbered +
          "\nReturn JSON: an array of objects {line:int, start:number, end:number} giving the start and end time in seconds of each line's speech.")
schema = {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {"line": {"type": "INTEGER"}, "start": {"type": "NUMBER"}, "end": {"type": "NUMBER"}}, "required": ["line", "start", "end"]}}
body = {"contents": [{"role": "user", "parts": [{"inlineData": {"mimeType": "audio/mp3", "data": data}}, {"text": prompt}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "responseSchema": schema}}
r = urllib.request.urlopen(urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    data=json.dumps(body).encode(), headers={"x-goog-api-key": KEY, "Content-Type": "application/json"}), timeout=120)
txt = "".join(p.get("text", "") for p in json.load(r)["candidates"][0]["content"]["parts"] if not p.get("thought"))
ts = sorted(json.loads(txt), key=lambda x: x["line"])
print("model timestamps:", [(x["line"], round(x["start"], 2), round(x["end"], 2)) for x in ts])
log = subprocess.run(["ffmpeg", "-i", take, "-af", "silencedetect=noise=-40dB:d=0.15", "-f", "null", "-"], capture_output=True, text=True).stderr
sil = [((float(s) + float(e)) / 2, float(e) - float(s)) for s, e in zip(re.findall(r"silence_start: ([\d.]+)", log), re.findall(r"silence_end: ([\d.]+)", log))]
total = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", take]).decode())
bounds = [0.0]
for a, b in zip(ts, ts[1:]):
    guess = (a["end"] + b["start"]) / 2
    near = min(sil, key=lambda s: abs(s[0] - guess)) if sil else (guess, 0)
    bounds.append(near[0] if abs(near[0] - guess) < 0.6 else guess)
bounds.append(total)
meta = json.load(open(f"{OUT}/vo.json"))
for i, (lid, text) in enumerate(LINES):
    a, b = bounds[i], bounds[i + 1]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", take, "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
        "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse",
        f"{OUT}/{lid}.wav"], check=True)
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{OUT}/{lid}.wav"]).decode())
    meta[lid]["seconds"] = round(d, 3)
    print(lid, f"{a:6.2f}-{b:6.2f}  {d:.2f}s  {text}")
json.dump(meta, open(f"{OUT}/vo.json", "w"), indent=2)
os.remove(f"{OUT}/take.mp3")

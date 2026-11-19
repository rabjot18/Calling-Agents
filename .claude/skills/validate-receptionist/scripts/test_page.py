#!/usr/bin/env python3
"""Local voice-orb test page for a client's Retell agent (a browser web call).

Usage: python3 -I test_page.py <client-slug> [--port 5174] [--version published|draft] [--no-open] [--idle-min 30]
Run from the repo root. The API key stays on this server: the browser only gets a one-time access token
from POST /v3/create-web-call. Binds to 127.0.0.1 and rejects other Host headers (DNS-rebinding guard).
"""
import json, os, re, socket, sys, threading, time, urllib.request, urllib.error, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API = "https://api.retellai.com"
ROOT = os.getcwd()
HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "templates", "test-page", "index.html")


def load_env(path):
    env = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
            if m and not line.lstrip().startswith("#"):
                env[m.group(1)] = m.group(2).strip('"').strip("'")
    return env


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


if len(sys.argv) < 2 or sys.argv[1].startswith("--"):
    sys.exit(__doc__)
SLUG = sys.argv[1]
KEY = os.environ.get("RETELL_API_KEY") or load_env(os.path.join(ROOT, ".env")).get("RETELL_API_KEY")
if not KEY:
    sys.exit("RETELL_API_KEY missing from the root .env")
IDS_PATH = os.path.join(ROOT, "clients", SLUG, "config", "ids.json")
if not os.path.exists(IDS_PATH):
    sys.exit(f"{IDS_PATH} not found: build the agent first")
IDS = json.load(open(IDS_PATH))
AGENT_ID = IDS.get("agent_id") or sys.exit("agent_id missing from ids.json")
MODE = arg("--version", "published")
VERSION = IDS.get("published_version") if MODE == "published" else None
IDLE = int(arg("--idle-min", "30")) * 60
LAST = [time.time()]
# The browser SDK comes from jsdelivr's +esm bundles, whose dependency imports are root-relative ("/npm/…").
# Serving them through this origin makes every import resolve here, so we proxy versioned +esm paths only.
NPM_PATH = re.compile(r"^/npm/(@[a-z0-9._-]+/)?[a-z0-9._-]+@[0-9][A-Za-z0-9._-]*(/[A-Za-z0-9._/-]*)?/\+esm$")
NPM_CACHE = {}


def npm_proxy(path):
    if path not in NPM_CACHE:
        req = urllib.request.Request("https://cdn.jsdelivr.net" + path, headers={"User-Agent": "receptionist-testpage/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            NPM_CACHE[path] = r.read()
    return NPM_CACHE[path]


def retell(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "User-Agent": "receptionist-testpage/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {"error_message": f"HTTP {e.code}"}
    except Exception as e:
        return 502, {"error_message": str(e)}


code, AGENT = retell("GET", f"/get-agent/{AGENT_ID}" + (f"?version={VERSION}" if VERSION is not None else ""))
if code != 200:
    sys.exit(f"get-agent failed: HTTP {code} {AGENT}")
PAGE_VARS = {
    "CLIENT": SLUG.replace("-", " ").title(),
    "AGENT_NAME": AGENT.get("agent_name") or AGENT_ID,
    "AGENT_VERSION": f"v{VERSION}" if VERSION is not None else "latest draft",
    "PHONE": IDS.get("phone_number") or "no number yet",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a):
        sys.stderr.write("[test-page] " + (fmt % a) + "\n")

    def _host_ok(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def _send(self, code, body, ctype="application/json"):
        raw = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        LAST[0] = time.time()
        if not self._host_ok():
            return self._send(403, {"error": "bad host"})
        if self.path in ("/", "/index.html"):
            html = open(TEMPLATE, encoding="utf-8").read()
            for k, v in PAGE_VARS.items():
                html = html.replace("{{" + k + "}}", str(v).replace("<", "&lt;"))
            return self._send(200, html.encode(), "text/html; charset=utf-8")
        if NPM_PATH.match(self.path):
            try:
                return self._send(200, npm_proxy(self.path), "text/javascript; charset=utf-8")
            except Exception as e:
                return self._send(502, {"error": f"CDN fetch failed: {e}"})
        m = re.fullmatch(r"/api/call/([A-Za-z0-9_\-]{6,80})", self.path)
        if m:
            code, call = retell("GET", f"/v2/get-call/{m.group(1)}")
            if code != 200:
                return self._send(code, call)
            if call.get("agent_id") != AGENT_ID:
                return self._send(403, {"error": "not this agent's call"})
            lat = call.get("latency") or {}
            pick = lambda k: (lat.get(k) or {}).get("p50")
            return self._send(200, {
                "status": call.get("call_status"), "transcript": call.get("transcript"),
                "analysis": call.get("call_analysis"), "disconnection_reason": call.get("disconnection_reason"),
                "duration_ms": call.get("duration_ms"), "latency_p50": {"e2e": pick("e2e"), "llm": pick("llm"), "tts": pick("tts")},
                "cost": (call.get("call_cost") or {}).get("combined_cost"),
                "tool_calls": [t for t in (call.get("transcript_with_tool_calls") or []) if t.get("role") in ("tool_call_invocation", "tool_call_result")][:20],
            })
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        LAST[0] = time.time()
        if not self._host_ok():
            return self._send(403, {"error": "bad host"})
        if self.path != "/api/start":
            return self._send(404, {"error": "not found"})
        body = {"agent_id": AGENT_ID, "metadata": {"source": "local-test-page"}}
        if VERSION is not None:
            body["agent_version"] = VERSION
        code, res = retell("POST", "/v3/create-web-call", body)
        if code not in (200, 201):
            return self._send(code, res)
        return self._send(200, {k: res.get(k) for k in ("call_id", "access_token", "transport", "ice_servers")})


def free_port(start):
    for p in range(start, start + 20):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    sys.exit("no free port")


def idle_watch(server):
    while True:
        time.sleep(30)
        if time.time() - LAST[0] > IDLE:
            print("[test-page] idle, shutting down", flush=True)
            server.shutdown()
            return


port = free_port(int(arg("--port", "5174")))
server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
url = f"http://127.0.0.1:{port}/"
print(json.dumps({"url": url, "agent": PAGE_VARS["AGENT_NAME"], "version": PAGE_VARS["AGENT_VERSION"]}), flush=True)
threading.Thread(target=idle_watch, args=(server,), daemon=True).start()
if "--no-open" not in sys.argv:
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass

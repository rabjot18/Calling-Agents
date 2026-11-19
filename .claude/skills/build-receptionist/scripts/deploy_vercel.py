#!/usr/bin/env python3
"""Deploy a client's custom functions folder to Vercel through the REST API.

Usage:
  python3 -I deploy_vercel.py <functions_dir> <project_name> [--env NAME ...]

- VERCEL_TOKEN (required) and VERCEL_TEAM_ID (optional) are read from the environment.
- Each --env NAME is read from the environment (never passed on the command line) and
  upserted as an encrypted production env var on the project.
- Creates the project if missing, deploys every file under <functions_dir> to production,
  waits until it's READY, checks that https://<project>.vercel.app/api/health answers without
  auth (turning off Vercel Authentication protection if it doesn't), and prints JSON
  {"url", "deployment_id"}.
Standard library only.
"""
import base64, json, os, sys, time, urllib.request, urllib.error

API = "https://api.vercel.com"
TOKEN = os.environ.get("VERCEL_TOKEN") or sys.exit("VERCEL_TOKEN is not set (it belongs in the root .env)")
TEAM = os.environ.get("VERCEL_TEAM_ID")


def call(method, path, body=None, ok=(200, 201)):
    sep = "&" if "?" in path else "?"
    url = API + path + (f"{sep}teamId={TEAM}" if TEAM else "")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        payload = e.read().decode(errors="replace")
        if e.code in ok:
            return e.code, json.loads(payload or "{}")
        return e.code, {"error": payload[:500]}


def public_status(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "deploy-check"}), timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    root, name = sys.argv[1], sys.argv[2]
    envs = [sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--env"]

    code, _ = call("GET", f"/v9/projects/{name}")
    if code == 404:
        code, res = call("POST", "/v11/projects", {"name": name, "framework": None})
        if code not in (200, 201):
            sys.exit(f"create project failed: HTTP {code} {res}")
    elif code != 200:
        sys.exit(f"project lookup failed: HTTP {code} (check VERCEL_TOKEN / VERCEL_TEAM_ID)")

    if envs:
        missing = [n for n in envs if not os.environ.get(n)]
        if missing:
            sys.exit(f"env vars not set locally: {missing}")
        body = [{"key": n, "value": os.environ[n], "type": "encrypted", "target": ["production"]} for n in envs]
        code, res = call("POST", f"/v10/projects/{name}/env?upsert=true", body)
        if code not in (200, 201) or res.get("failed"):
            sys.exit(f"env upsert failed: HTTP {code} {json.dumps(res.get('failed', res))[:400]}")

    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".vercel", ".git")]
        for fn in filenames:
            if fn.startswith(".env"):
                continue  # secrets never ship as files
            p = os.path.join(dirpath, fn)
            files.append({"file": os.path.relpath(p, root).replace(os.sep, "/"),
                          "data": base64.b64encode(open(p, "rb").read()).decode(), "encoding": "base64"})
    code, dep = call("POST", "/v13/deployments?skipAutoDetectionConfirmation=1", {
        "name": name, "project": name, "target": "production", "files": files,
        "projectSettings": {"framework": None}})
    if code not in (200, 201):
        sys.exit(f"deploy failed: HTTP {code} {dep}")
    dep_id = dep["id"]
    state = None
    for _ in range(90):
        code, d = call("GET", f"/v13/deployments/{dep_id}")
        state = d.get("readyState")
        if state in ("READY", "ERROR", "CANCELED"):
            break
        time.sleep(4)
    if state != "READY":
        sys.exit(f"deployment {dep_id} ended in {state}")

    url = f"https://{name}.vercel.app"
    status = public_status(url + "/api/health")
    if status in (401, 403):
        # Vercel Authentication (deployment protection) is on; Retell must reach us unauthenticated.
        call("PATCH", f"/v9/projects/{name}", {"ssoProtection": None})
        time.sleep(5)
        status = public_status(url + "/api/health")
    if status != 200:
        sys.exit(f"deployed but {url}/api/health returned HTTP {status}")
    print(json.dumps({"url": url, "deployment_id": dep_id}))


if __name__ == "__main__":
    main()

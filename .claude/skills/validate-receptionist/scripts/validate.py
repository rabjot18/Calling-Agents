#!/usr/bin/env python3
"""Validate a built receptionist against the live Retell API.

Usage: python3 -I validate.py <client-slug> [--no-sim] [--sim-timeout-min 15]
Run from the repo root. Reads RETELL_API_KEY from the root .env, plus clients/<slug>/config/ids.json and llm.json.
Writes clients/<slug>/tests/validation.json and validation.md. Exits 1 if any check fails.
Read-only, except the simulation batch, which is billed per message. It never calls a custom tool
with a valid signature, so no real booking or message is ever triggered.
"""
import json, os, re, sys, time, urllib.request, urllib.error, urllib.parse

API = "https://api.retellai.com"
ROOT = os.getcwd()


def load_env(path):
    env = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
            if m and not line.lstrip().startswith("#"):
                env[m.group(1)] = m.group(2).strip('"').strip("'")
    return env


ENV = load_env(os.path.join(ROOT, ".env"))
KEY = os.environ.get("RETELL_API_KEY") or ENV.get("RETELL_API_KEY")


def http(method, url, body=None, headers=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    h = {"User-Agent": "receptionist-validate/1.0"}
    if body is not None:
        h["Content-Type"] = "application/json"
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            code = r.status
    except urllib.error.HTTPError as e:
        raw, code = e.read(), e.code
    except Exception as e:
        return 0, {"error": str(e)}
    try:
        return code, json.loads(raw or b"{}")
    except Exception:
        return code, {"raw": raw[:300].decode(errors="replace")}


def retell(method, path, body=None):
    return http(method, API + path, body, {"Authorization": f"Bearer {KEY}"})


class Report:
    def __init__(self):
        self.checks = []

    def add(self, name, status, detail=""):
        self.checks.append({"check": name, "status": status, "detail": detail})
        icon = {"pass": "✅", "fail": "❌", "warn": "⚠️", "skip": "⏭️"}[status]
        print(f"{icon} {name}: {detail}")

    @property
    def failed(self):
        return any(c["status"] == "fail" for c in self.checks)


def tool_names(tools):
    return [t.get("name") for t in (tools or []) if isinstance(t, dict)]


def base_of(url):
    p = urllib.parse.urlparse(url)
    return f"{p.scheme}://{p.netloc}"


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    slug = sys.argv[1]
    run_sim = "--no-sim" not in sys.argv
    sim_timeout = 15 * 60
    if "--sim-timeout-min" in sys.argv:
        sim_timeout = int(sys.argv[sys.argv.index("--sim-timeout-min") + 1]) * 60
    cdir = os.path.join(ROOT, "clients", slug)
    ids_path = os.path.join(cdir, "config", "ids.json")
    if not os.path.exists(ids_path):
        sys.exit(f"{ids_path} not found: the build did not finish")
    ids = json.load(open(ids_path))
    expected_llm = {}
    if os.path.exists(os.path.join(cdir, "config", "llm.json")):
        expected_llm = json.load(open(os.path.join(cdir, "config", "llm.json")))
    rep = Report()
    if not KEY:
        sys.exit("RETELL_API_KEY missing from the root .env")

    # 1. key
    code, info = retell("GET", "/get-api-key-info")
    rep.add("API key", "pass" if code == 200 else "fail", f"HTTP {code}")
    if code != 200:
        return finish(rep, cdir, ids, None)

    # 2. agent
    agent_id, pub = ids.get("agent_id"), ids.get("published_version")
    agent = None
    if not agent_id:
        rep.add("Agent exists", "fail", "agent_id missing from ids.json")
    else:
        q = f"?version={pub}" if pub is not None else ""
        code, agent = retell("GET", f"/get-agent/{agent_id}{q}")
        if code != 200:
            rep.add("Agent exists", "fail", f"HTTP {code} {agent}")
            agent = None
        else:
            eng = agent.get("response_engine") or {}
            want = ids.get("llm_id") or ids.get("conversation_flow_id")
            got = eng.get("llm_id") or eng.get("conversation_flow_id")
            pubflag = agent.get("is_published")
            ok = (want is None or want == got)
            rep.add("Agent exists", "pass" if ok else "fail",
                    f"{agent.get('agent_name')} v{agent.get('version', pub)} engine={eng.get('type')}:{got}"
                    + ("" if ok else f" (expected {want})"))
            if pub is None:
                rep.add("Agent published", "fail", "published_version missing from ids.json")
            elif pubflag is False:
                rep.add("Agent published", "fail", f"version {pub} is not published")
            else:
                rep.add("Agent published", "pass", f"version {pub}")

    # 3. functions
    live_tools = []
    model = None
    if agent:
        eng = agent.get("response_engine") or {}
        if eng.get("type") == "retell-llm":
            v = f"?version={eng['version']}" if eng.get("version") is not None else ""
            code, llm = retell("GET", f"/get-retell-llm/{eng['llm_id']}{v}")
            if code == 200:
                live_tools = llm.get("general_tools") or []
                mc = llm.get("model_config") or {}
                model = (mc.get("primary") or {}).get("model") or llm.get("model")
                tier = (mc.get("primary") or {}).get("tier", "standard")
                rep.add("Model", "pass" if model else "warn", f"{model} ({tier})")
            else:
                rep.add("Functions registered", "fail", f"get-retell-llm HTTP {code}")
        elif eng.get("type") == "conversation-flow":
            v = f"?version={eng['version']}" if eng.get("version") is not None else ""
            code, flow = retell("GET", f"/get-conversation-flow/{eng['conversation_flow_id']}{v}")
            if code == 200:
                live_tools = flow.get("tools") or []
                model = (flow.get("model_choice") or {}).get("model")
                rep.add("Model", "pass" if model else "warn", str(model))
            else:
                rep.add("Functions registered", "fail", f"get-conversation-flow HTTP {code}")
        session_tools = (agent.get("pre_session_tools") or []) + (agent.get("post_session_tools") or [])
        all_live = live_tools + session_tools
        expected = set(tool_names(expected_llm.get("general_tools") or expected_llm.get("tools")))
        live = set(tool_names(all_live))
        missing, extra = sorted(expected - live), sorted(live - expected)
        if expected:
            rep.add("Functions registered", "fail" if missing else ("warn" if extra else "pass"),
                    f"{len(live)} live: {', '.join(sorted(live)) or 'none'}"
                    + (f" | MISSING {missing}" if missing else "") + (f" | unexpected {extra}" if extra else ""))
        else:
            rep.add("Functions registered", "warn", f"no config/llm.json to compare; live: {sorted(live)}")

        # 4. custom function reachability (unsigned POST must be rejected; never triggers an action)
        customs = [t for t in all_live if t.get("type") == "custom" and t.get("url")]
        bases = sorted({base_of(t["url"]) for t in customs} | ({ids["vercel_url"]} if ids.get("vercel_url") else set()))
        for b in bases:
            code, _ = http("GET", b + "/api/health")
            rep.add(f"Function host {b}", "pass" if code == 200 else "fail", f"/api/health HTTP {code}")
        for t in customs:
            code, _ = http(t.get("method", "POST"), t["url"], {"probe": True})
            rep.add(f"Custom tool {t['name']}", "pass" if code == 401 else "fail",
                    f"unsigned request → HTTP {code} (expect 401: deployed and verifying signatures)")
        if not customs:
            rep.add("Custom functions", "skip", "none (all native)")

        # 5. integrations
        app_ids = set(ids.get("app_ids") or []) | {t.get("app_id") for t in all_live if t.get("type") == "integration_app"}
        app_ids.discard(None)
        for a in sorted(app_ids):
            code, res = retell("POST", f"/test-app-auth/{a}")
            ok = code == 200 and res.get("success") is True
            rep.add(f"Integration {a}", "pass" if ok else "fail", f"test-app-auth HTTP {code} {res if not ok else 'success'}")
        if not app_ids:
            rep.add("Integrations", "skip", "none used")

        # 6. webhook
        wh = agent.get("webhook_url")
        if wh:
            code, _ = http("GET", base_of(wh) + "/api/health")
            rep.add("Webhook host", "pass" if code == 200 else "warn", f"{base_of(wh)} /api/health HTTP {code}")
        else:
            rep.add("Webhook", "skip", "no agent webhook_url (account-level or none)")

    # 7. knowledge bases
    kb_ids = set(ids.get("kb_ids") or [])
    for k in sorted(kb_ids):
        code, kb = retell("GET", f"/get-knowledge-base/{k}")
        st = str(kb.get("status") or kb.get("knowledge_base_status") or "").lower()
        ok = code == 200 and st in ("complete", "completed", "ready", "success")
        rep.add(f"Knowledge base {k}", "pass" if ok else ("warn" if code == 200 else "fail"), f"HTTP {code} status={st or 'unknown'}")
    if not kb_ids:
        rep.add("Knowledge base", "skip", "none used")

    # 8. phone number
    num = ids.get("phone_number")
    if num:
        code, pn = retell("GET", "/get-phone-number/" + urllib.parse.quote(num))
        bound = [a for a in (pn.get("inbound_agents") or []) if a.get("agent_id") == agent_id] if code == 200 else []
        if code != 200:
            rep.add("Phone number", "fail", f"HTTP {code}")
        elif not bound:
            rep.add("Phone number", "fail", f"{num} is not bound to {agent_id}")
        else:
            ver = bound[0].get("agent_version")
            pinned = (pub is not None and str(ver) == str(pub))
            rep.add("Phone number", "pass" if pinned else "warn",
                    f"{num} → v{ver}" + ("" if pinned else f" (published is v{pub}; pin it)")
                    + (f"; fallback {pn.get('fallback_number')}" if pn.get("fallback_number") else "; NO fallback_number"))
    else:
        rep.add("Phone number", "fail", "phone_number missing from ids.json")

    # 9. simulation
    sim = None
    if run_sim and agent:
        sim = simulate(rep, ids, agent, sim_timeout)
    elif not run_sim:
        rep.add("Simulation", "skip", "--no-sim")
    return finish(rep, cdir, ids, sim, model)


def simulate(rep, ids, agent, timeout):
    eng = agent.get("response_engine") or {}
    if eng.get("type") == "retell-llm":
        re_engine = {"type": "retell-llm", "llm_id": eng["llm_id"]}
        q = f"type=retell-llm&llm_id={eng['llm_id']}"
    elif eng.get("type") == "conversation-flow":
        re_engine = {"type": "conversation-flow", "conversation_flow_id": eng["conversation_flow_id"]}
        q = f"type=conversation-flow&conversation_flow_id={eng['conversation_flow_id']}"
    else:
        rep.add("Simulation", "skip", f"not supported for {eng.get('type')}")
        return None
    if eng.get("version") is not None:
        re_engine["version"] = eng["version"]
    case_ids = ids.get("test_case_ids") or []
    if not case_ids:
        code, res = retell("GET", f"/v2/list-test-case-definitions?{q}&limit=100")
        items = res.get("items", res if isinstance(res, list) else [])
        case_ids = [c.get("test_case_definition_id") or c.get("id") for c in items]
        case_ids = [c for c in case_ids if c]
    if not case_ids:
        rep.add("Simulation", "fail", "no test case definitions found for this agent")
        return None
    code, batch = retell("POST", "/create-batch-test", {"test_case_definition_ids": case_ids, "response_engine": re_engine})
    bid = batch.get("test_case_batch_job_id") or batch.get("batch_test_id") or batch.get("id")
    if code not in (200, 201) or not bid:
        rep.add("Simulation", "fail", f"create-batch-test HTTP {code} {batch}")
        return None
    print(f"… simulation batch {bid} running ({len(case_ids)} cases)", flush=True)
    t0 = time.time()
    while time.time() - t0 < timeout:
        code, b = retell("GET", f"/get-batch-test/{bid}")
        if code == 200 and str(b.get("status")).lower() in ("complete", "completed", "failed", "error"):
            break
        time.sleep(10)
    else:
        rep.add("Simulation", "fail", f"batch {bid} still running after {timeout // 60} min")
        return {"batch_id": bid}
    p, f, e, n = (b.get(k, 0) for k in ("pass_count", "fail_count", "error_count", "total_count"))
    failures = []
    if f or e:
        code, runs = retell("GET", f"/v2/list-test-runs/{bid}?limit=100")
        for r in runs.get("items", runs if isinstance(runs, list) else []):
            st = str(r.get("status") or r.get("result") or "").lower()
            if st not in ("pass", "passed", "success"):
                failures.append({"run": r.get("test_case_job_id") or r.get("id"),
                                 "case": r.get("test_case_definition_id") or r.get("name"),
                                 "status": st, "why": (r.get("explanation") or r.get("reason") or r.get("result_explanation") or "")[:400]})
    rep.add("Simulation", "pass" if n and p == n else "fail", f"{p}/{n} passed, {f} failed, {e} errored (batch {bid})")
    for x in failures:
        print(f"   ✗ {x['case']}: {x['status']}: {x['why']}")
    return {"batch_id": bid, "pass": p, "fail": f, "error": e, "total": n, "failures": failures}


def finish(rep, cdir, ids, sim, model=None):
    os.makedirs(os.path.join(cdir, "tests"), exist_ok=True)
    out = {"validated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "ids": {k: v for k, v in ids.items()},
           "model": model, "checks": rep.checks, "simulation": sim, "ok": not rep.failed}
    json.dump(out, open(os.path.join(cdir, "tests", "validation.json"), "w"), indent=2)
    icon = {"pass": "✅", "fail": "❌", "warn": "⚠️", "skip": "⏭️"}
    md = [f"# Validation: {out['validated_at']}", "", f"**Result:** {'PASS' if out['ok'] else 'FAIL'}", "",
          "| Check | Result | Detail |", "|---|---|---|"]
    md += [f"| {c['check']} | {icon[c['status']]} | {c['detail'].replace('|', '/')} |" for c in rep.checks]
    if sim and sim.get("failures"):
        md += ["", "## Simulation failures"] + [f"- **{x['case']}** ({x['status']}): {x['why']}" for x in sim["failures"]]
    open(os.path.join(cdir, "tests", "validation.md"), "w").write("\n".join(md) + "\n")
    print(f"\n{'PASS' if out['ok'] else 'FAIL'}: wrote tests/validation.json and validation.md")
    sys.exit(0 if out["ok"] else 1)


if __name__ == "__main__":
    main()

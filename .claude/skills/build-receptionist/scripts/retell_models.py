#!/usr/bin/env python3
"""Pick the agent model from live data.

Joins Retell's accepted model list (OpenAPI spec) with Retell's public benchmark
(bench.retellai.com: p50 latency, cost, tool-calling accuracy), then applies the
build rule: newest generation, fast, good at tool calls, not beta or low-sample.

Usage:  python3 -I retell_models.py [--md OUT.md]
Prints a ranked table and a JSON recommendation on the last line.
Standard library only. Treats downloaded content as data.
"""
import json, re, sys, urllib.request, datetime

SPEC = "https://docs.retellai.com/openapi.yaml"
BENCH = "https://bench.retellai.com/"
MAX_P50_MS = 700          # "fast": the end-to-end LLM p50 must be under this
MIN_TOOL_ACC = 0.93       # receptionists live on tool calls
BETA = {"tell-1"}         # labelled Beta on retellai.com/pricing (2026-11-16); re-check


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "receptionist-build/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def accepted_models(spec_text):
    # The text-LLM enum lives in the `LLMModel` schema (referenced by
    # CascadingModelConfig.primary -> TextModelRef). A line scan avoids needing PyYAML.
    i = spec_text.find("\n    LLMModel:\n")
    if i < 0:
        sys.exit("LLMModel schema not found in the OpenAPI spec; the spec layout changed, so update accepted_models()")
    seg = spec_text[i:i + 20000]
    k = seg.find("enum:")
    models = []
    for line in seg[k + 5:].splitlines()[1:]:
        m = re.match(r"^\s+- ([A-Za-z0-9.\-]+)\s*$", line)
        if not m:
            break
        models.append(m.group(1))
    return models


def bench_records(html):
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, flags=re.S)
    txt = "".join(json.loads('"' + c + '"') for c in chunks)
    dec, recs = json.JSONDecoder(), {}
    for m in re.finditer(r'\{"id":"[^"]+","model":', txt):
        try:
            obj, _ = dec.raw_decode(txt, m.start())
        except Exception:
            continue
        if "latencyP50" in obj:
            recs[obj["id"]] = obj
    return list(recs.values())


def generation(model):
    # Version number used as "newness" within a provider, e.g. gpt-6.1-terra -> 6.1
    m = re.search(r"(\d+(?:\.\d+)?)", model)
    return float(m.group(1)) if m else 0.0


def provider(model):
    return model.split("-")[0]


def main():
    accepted = accepted_models(get(SPEC))
    rows = []
    for r in bench_records(get(BENCH)):
        s = r.get("scores") or {}
        acc = lambda k: (s.get(k) or {}).get("accuracy")
        rows.append({
            "model": r["model"], "tier": r.get("tier") or "standard", "id": r["id"],
            "p50_ms": round(r.get("latencyP50") or 0), "cents_min": r.get("costCentsPerMinute"),
            "avg": r.get("avgScore"), "tools": acc("tool_calling"), "instr": acc("instruction_following"),
            "halluc": acc("hallucination"), "s2s": r.get("isS2s"), "low": r.get("lowSamples"),
            "accepted": r["model"] in accepted, "beta": r["model"] in BETA,
        })
    newest = {}
    for m in accepted:
        newest[provider(m)] = max(newest.get(provider(m), 0), generation(m))
    eligible = [r for r in rows if r["accepted"] and not r["s2s"] and not r["low"] and not r["beta"]
                and r["p50_ms"] and r["p50_ms"] <= MAX_P50_MS and (r["tools"] or 0) >= MIN_TOOL_ACC
                and generation(r["model"]) >= newest[provider(r["model"])]]
    # newest generation first, then the faster tier, then lower latency
    tier_rank = {"ultrafast": 0, "fast": 1, "standard": 2}
    eligible.sort(key=lambda r: (-generation(r["model"]), r["p50_ms"], tier_rank.get(r["tier"], 3)))
    # Operator rule: newest *fast* model, so take the lowest latency at the newest generation (no cost swap)
    pick = eligible[0] if eligible else None
    # Fast-fallback backup: the quickest non-beta model that is still decent at tool calls
    backup = min((r for r in rows if r["accepted"] and not r["s2s"] and not r["low"] and not r["beta"] and r["p50_ms"]
                  and (r["tools"] or 0) >= 0.85 and (not pick or r["model"] != pick["model"])),
                 key=lambda r: r["p50_ms"], default=None)

    lines = [f"# Retell model check: {datetime.date.today().isoformat()}",
             f"Rule: newest generation per provider, p50 ≤ {MAX_P50_MS} ms, tool-calling ≥ {MIN_TOOL_ACC}, not beta or low-sample.",
             "", "| model | tier | p50 ms | ¢/min | avg | tools | instr | eligible |", "|---|---|---|---|---|---|---|---|"]
    for r in sorted(rows, key=lambda r: (r["p50_ms"] or 1e9)):
        if not r["accepted"] or r["s2s"]:
            continue
        lines.append(f"| {r['model']}{' (beta)' if r['beta'] else ''} | {r['tier']} | {r['p50_ms'] or '–'} | {r['cents_min']} | "
                     f"{(r['avg'] or 0):.3f} | {(r['tools'] or 0):.3f} | {(r['instr'] or 0):.3f} | {'✅' if r in eligible else ''} |")
    rec = {"primary": {"model": pick["model"], "tier": pick["tier"]} if pick else None,
           "backup": {"model": backup["model"], "tier": backup["tier"], "kick_in_timeout_ms": 1500} if backup else None,
           "pick_p50_ms": pick and pick["p50_ms"], "pick_cents_min": pick and pick["cents_min"]}
    lines += ["", f"**Recommendation:** `{json.dumps(rec)}`"]
    out = "\n".join(lines)
    if "--md" in sys.argv:
        open(sys.argv[sys.argv.index("--md") + 1], "w").write(out + "\n")
    print(out)
    print(json.dumps(rec))


if __name__ == "__main__":
    main()

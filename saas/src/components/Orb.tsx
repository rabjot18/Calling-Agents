"use client";
import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { api, MicIcon } from "./ui";

// Tap-to-talk test call with the owner's own receptionist: a Retell web call via a server-minted token, or (on Vapi)
// a Vapi web call started in the browser with the public key. The secret API keys never reach the browser.
type VapiClient = { start: (assistantId: string) => Promise<unknown>; stop: () => Promise<void> | void; on: (e: string, f: (...a: never[]) => void) => void };

export function Orb({ name = "Maya", onEnded }: { name?: string; onEnded?: () => void }) {
  const client = useRef<RetellWebClient | null>(null);
  const vapiClient = useRef<VapiClient | null>(null);
  const level = useRef(0);
  const orb = useRef<HTMLButtonElement | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "live">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const c = new RetellWebClient();
    client.current = c;
    c.on("call_started", () => setState("live"));
    c.on("call_ended", () => {
      setState("idle");
      onEnded?.();
    });
    c.on("error", (e: unknown) => {
      setError(String((e as Error)?.message ?? e));
      setState("idle");
      c.stopCall();
    });
    let raf = 0;
    const tick = () => {
      const a = (c as unknown as { analyzerComponent?: { calculateVolume?: () => number } }).analyzerComponent;
      const v = vapiClient.current ? level.current : (a?.calculateVolume?.() ?? 0) * 4;
      if (orb.current) orb.current.style.transform = `scale(${1 + Math.min(1, v) * 0.25})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      c.stopCall();
      void vapiClient.current?.stop();
    };
  }, [onEnded]);

  async function startVapi(publicKey: string, assistantId: string) {
    if (!vapiClient.current) {
      const { default: Vapi } = await import("@vapi-ai/web");
      const v = new Vapi(publicKey) as unknown as VapiClient;
      v.on("call-start", () => setState("live"));
      v.on("call-end", () => {
        setState("idle");
        level.current = 0;
        onEnded?.();
      });
      v.on("volume-level", (x: never) => { level.current = Number(x) || 0; });
      v.on("error", (e: never) => {
        const err = e as { error?: { message?: string }; message?: string };
        setError(err?.error?.message ?? err?.message ?? "The call dropped.");
        setState("idle");
      });
      vapiClient.current = v;
    }
    await vapiClient.current.start(assistantId);
  }

  async function toggle() {
    setError("");
    if (state !== "idle") {
      if (vapiClient.current) await vapiClient.current.stop();
      return client.current?.stopCall();
    }
    setState("connecting");
    try {
      const t = await api<{ platform?: string; publicKey?: string; assistantId?: string; callId: string; accessToken: string; transport: string; iceServers: RTCIceServer[] }>("/api/webcall", { method: "POST" });
      if (t.platform === "vapi") return await startVapi(t.publicKey!, t.assistantId!);
      await client.current!.startCall({ accessToken: t.accessToken, callId: t.callId, transport: t.transport as "gateway", iceServers: t.iceServers });
      await client.current!.startAudioPlayback().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the call");
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="orb-halo orb-wrap" style={{ width: 160, height: 160 }}>
        {state === "live" && (
          <>
            <span className="ring" aria-hidden="true" />
            <span className="ring" aria-hidden="true" />
            <span className="ring" aria-hidden="true" />
          </>
        )}
        <button ref={orb} className={`orb ${state === "idle" ? "idle" : ""}`} onClick={toggle} aria-label={state === "idle" ? `Talk to ${name}` : "End call"}>
          <MicIcon size={30} />
        </button>
      </div>
      <p className="text-sm font-medium" aria-live="polite">
        {state === "idle" ? `Tap to talk to ${name}` : state === "connecting" ? "Connecting…" : "Live. Tap to hang up"}
      </p>
      {error && <p className="text-sm text-[var(--ribbon)]" role="alert">{error}</p>}
    </div>
  );
}

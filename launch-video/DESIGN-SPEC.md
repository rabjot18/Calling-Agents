# Pulse launch video: design spec

Mode: **autonomous creation**, picked by the agent on 2026-11-17. The operator asked for "the same kind of launch video… exactly … animations like that", so the reference's motion vocabulary is a hard constraint. The skin comes from Pulse's own design system (`saas/DESIGN.md`).

## Product brief
- **Product:** Pulse is an AI phone receptionist for small businesses (salons, clinics, restaurants, trades).
  - It answers every call, takes bookings and messages, and flags urgent calls.
  - It writes each call onto an hour-ruled "day page", with summaries and transcripts.
  - Setup is a 10-minute chat.
- **Audience:** small-business owners who miss calls while they work.
- **Use:** a launch video for social and the landing page. 16:9, 1920×1080, 30 fps, about 48 s, English, music only (no voiceover). That matches the reference.

## Requirements → execution decisions
| Requirement | Effect on this film |
|---|---|
| Same animation style as the reference (IG reel, a "Pulse" creator-analytics promo) | We reuse its grammar: dark kinetic word-by-word type with highlight pills, a typewriter, an orb → logo reveal on the musical drop, a light product section with tilted real UI, cursor clicks, glowing rows, a toast, a convergence diagram, sliding funnel chips, a glowing tagline outro and a CTA. We don't copy its talking-head footage (we have none) or its product. |
| Cater to Pulse | Every beat is a Pulse claim: answers every call, writes it into your day, knows what's urgent, transcripts and summaries, books for you. |
| Real UI, safe data | Captures come from an **isolated demo copy** of the app (scratchpad `pulse-demo`, its own SQLite). It holds a fictional salon, "Fern & Fade Salon", with invented callers and 555 numbers. No operator or customer data. |
| Music | Mixkit "House Vibez" (Lily J). Free commercial licence, no credit needed. 122.006 BPM. The excerpt starts at 53.20 s (breakdown), so the **drop at 63.04 s = beat 20** lands on the logo reveal. Energy dips at beat 84 for the outro. |
| Deliverables | `out/pulse-launch.mp4` (with BGM) and `out/pulse-launch-nobgm.mp4` (SFX only), from one timeline via the `bgm` prop. |

## Visual tokens (from saas/DESIGN.md, plus a restrained extension)
- **Cloth** `#1d3a30`, **paper** `#fbfcfa`, **ink** `#16201b`, **muted** `#55655b`, **rule** `#e1e7e0`, **ribbon** `#b3261e`. The red of the logo bar is `#d23b31`.
- **Extension (video only):**
  - **Signal green** `#3dd68c` is the glow and pill colour on dark scenes. It's the cloth hue raised to light, so the green glow of the reference stays on-brand.
  - **Pill green** `#1f9d5c` carries white text on paper scenes.
  - **Night** `#06100b` → `#0c1a13` is the dark background (cloth pushed to black).
  - **Red pills** are reserved for the *problem* words: missed, urgent. That mirrors the product rule "red = urgent".
- **Type:** Archivo (the app's own woff2 files, with the `wdth` axis). Headlines are 700–800 at `font-stretch: 80%` (the app's `.cond` cut). Body is 500.
- **Mark:** `PulseMark`, a cloth tile with five uneven bars and a red centre bar.

## Motion tokens
- **Dark kinetic section:** "bold startup" preset. 18 f entries, `bezier(.16,1,.3,1)`, overshoot only on the pill pop (1.08).
- **Product section:** "professional" preset. 21 f, `bezier(0,0,.2,1)`, no bounce except where something lands (the row embed's press, the toast).
- **One voice:** blur-slide is the default text reveal everywhere; each other card plays the lead once.

## Motion breakdown (reference → Pulse)
| Technique | Reference | Pulse adaptation |
|---|---|---|
| Kinetic words + pill | "You just got [zz] warm" | `blur-slide` stem plus `pill-slot-cycle`: "You just missed [a booking] → [a regular] → [$140]", resolving to "a call." |
| Typewriter | "But which video actually [pill]" | `typewriter-moves` error-retype: "Who answers when you're **busy** ⌫ **with a customer?**" |
| Orb → logo | Green orb, rings, "● Pulse" | `logo-shrink-wordmark-lockup`: the green ring collapses on the drop into the PulseMark, then the wordmark and tagline arrive |
| Green glow swipes | Bright green gradient swipes between scenes | `transition-hidden-cut` light-leak-burn, recoloured to signal green. Used once, at the dark → light hand-off (Q4 single use). |
| Tilted UI + caption | "It lets you [track conversions]" over a tilted dashboard | PageCam 3D tilt-up of the real Today page, plus "Every call, [answered.]" |
| Glowing table row | Row glows green | `row-embed`: new calls drop into their hour lines with a green seam |
| Hub/flow diagram | Social icons → hub | `bezier-source-converge-merge`: four caller sources converge into the PulseMark |
| Toast notification | "Call Booked" toast with green glow | A spring toast "Urgent · Dana Ruiz" over the Today page, with a red ribbon |
| Cursor zooms | Cursor clicks around the UI | `cursor-flyover`: three stations on the real call-history page (row → summary → transcript) |
| Funnel chips | "2.7K Clicks → 0 Leads → … Customers ● Pulse" | Sliding chips with DigitRoll counters: "38 calls → 38 answered → 14 booked → $1,640 ● Pulse" |
| Outro | Orb, "● Pulse [Intelligent tracking…]", "Start your [Free trial] today." | Lockup held; a glowing tag slides out ("Answers. Books. Remembers."); "Start answering every call [today.]" |

## Storyboard (beat grid: beat n = n × 0.49178 s; `beatF(n) = n × 14.7534 f`)
| # | Beats | Shot | Key motion |
|---|---|---|---|
| S1 | 0–8 | Dark. "You just missed [a booking] → [a regular] → [$140]" → "a call." | blur-slide stem + pill-slot cycle (red pills) |
| S2 | 8–15 | Dark. "Who answers when you're busy⌫ with a customer?" | error-retype, green highlight under "with a customer?" |
| S3 | 15–27 | Dark. Huge blurred "Meet" → ring collapses on the **drop (beat 20)** → PulseMark + "Pulse" + tagline | logo lockup, shockwave on the drop |
| T1 | 26.5–27.5 | Green light-leak sweep, hard cut at the peak | light-leak-burn |
| P1 | 27–35 | Paper. "Every call, [answered.]" + Today page tilting up to flat | PageCam 3D tilt |
| P2 | 35–43 | Today page close-up: four calls drop into their hour lines, green seams; caption "Written straight into [your day.]" | row-embed |
| P3 | 43–51 | Paper. Missed calls · After hours · Google listing · Your website → PulseMark; "One number. [Every caller.]" | bezier convergence |
| P4 | 51–59 | Today page, urgent row in focus; toast springs in "Urgent · Dana Ruiz · scalp reaction, call back today"; "Knows what's [urgent.]" | toast + ribbon |
| P5 | 59–71 | Call history: cursor → Dana row (click) → summary → transcript name read-back; "Every word, [summarised.]" | cursor-flyover |
| P6 | 71–79 | Paper. Funnel chips slide: 38 calls → 38 answered → 14 booked → $1,640 ● Pulse; "This week, on autopilot." | conveyor + DigitRoll |
| P7 | 79–84 | Paper. "Stop sending customers to [voicemail.]" | blur-slide + red pill |
| O1 | 84–98 | Dark. Pulse lockup + glowing tag "Answers. Books. Remembers." → "Start answering every call [today.]" + "Set up in 10 minutes" | tag slide + CTA pill, hold ≥1 s |

Slams (whole-frame hits, ≤3): the drop (beat 20), the light-leak cut (beat 27), the funnel landing (beat 77).

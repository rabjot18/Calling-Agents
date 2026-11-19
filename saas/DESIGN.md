# Pulse design system

**World:** the front-desk appointment book. Chosen by the owner on 2026-11-16 over "message pad", "order ticket rail" and "clean and familiar".
It replaced the earlier pastel-gradient look.

**Mode:** an Operate surface (setup, dashboard). Standard controls, with the world limited to four things: type, palette, density and one signature move.

## Signature move
- **Today is a day page.** The hours of the business's own day run down a gutter, in its own time zone.
- Each call is written onto its hour line.
- Closed hours are hatched.
- A red line marks now.
- Urgent calls carry a red ribbon marker.

## Palette (tokens in `src/app/globals.css`)
- **cloth `#1d3a30`:** the shell rail, primary buttons and selected toggles.
- **paper `#fbfcfa`:** the page.
- **sheet `#fff`:** cards.
- **rule `#e1e7e0` / `#c7d1c7`:** ruled lines.
- **ink `#16201b`:** body text.
- **muted `#55655b`:** secondary text.
- **pen `#24477a`:** what the owner or caller wrote (interview answers, caller lines in transcripts), links and focus.
- **ribbon `#b3261e`:** urgent only.
- **Outcome tags:** ok (green), pen (blue), order (amber), spam (grey), urgent (ribbon).

## Type
- **Archivo, one family.** The `wdth` axis gives the narrow "printed diary" cut (`.cond`, `.h1`) for dates, hours, headings and numerals.
- **Body:** 15px with tabular numerals.
- **Scale:** 13 / 15 / 19 / 28, plus a 40–48px display size on the intro only.

## Components
- **Buttons:**
  - `.btn`: primary, cloth.
  - `.btn-soft`: secondary, sheet with a rule border.
  - `.btn-quiet`: a text action.
  - One 6px radius everywhere.
- **Inputs and toggles:** `.field`, `.chip` (toggle) and `.option` (a radio-style card with the pen selection colour).
- **Lists:** `.ruled` (ruled lists), `.entry` (a call row: time, who, tag, why) and `.ribbon`.
- **Shell:** `.shell`, `.rail` and `.page`. The rail becomes a top bar below 860px.

## Motion
- 150–250ms. Motion only for state:
  - a 180ms rise when a new question or step appears
  - rows re-flowing when filters change
  - the selected-row highlight sliding
  - the orb breathing while idle and rippling while live
  - a reading line moving over an uploaded menu
- Reduced motion turns everything off.
- **Onboarding, added 2026-11-18 at the owner's request ("motion, animation and 3D"):**
  - Setup is a book. Each step change turns a ruled page over the spine: forward turns left, back turns right, 620ms. The new step is already underneath, so nothing waits on it (`PageTurn` in `src/components/motion.tsx`).
  - The progress segments fill (or drain) from the last step to this one (`StepFill`).
  - While the website is read, the scanning-page preview shows.
  - The found card is laid down in 3D, then each find inks in.
  - The latest interview answer inks in, in pen.
  - The new phone number inks in.

## Never
- Kicker or eyebrow badges above headings.
- Gradient or glass decoration.
- Hero-metric stat tiles.
- Drag-to-continue sliders.
- Confetti.
- Title Case headings.
- Middle-dot meta strings.

## Name and mark
- **Name:** Pulse (renamed from Pickup on 2026-11-17).
- **Mark:** a book-cloth tile (`#1d3a30`, 6/24 corner radius) holding five uneven rounded bars, a voice pulse that reads as speech. The tallest, centre bar is red (`#d23b31`, slightly brighter than the ribbon so it holds up at 16px); it stands for the call that just came in.
- **Where it lives:** `PulseMark` and `Logo` in `src/components/ui.tsx`, and `src/app/icon.svg` (the favicon). On the cloth rail it inverts to a pale tile with cloth bars; the red bar never changes.
- **Wordmark:** "Pulse" in Archivo bold, condensed (`.cond`), next to the mark.

## Marketing landing (`/`), dark, third pass (2026-11-18)
History, all on 2026-11-18:
- A dark "after hours" version was rejected as "sticky" and "AI slop". It had a pinned scroll story, lamp glow, a giant logo hero and condensed 800 headings.
- A light "paper and ink" version was rejected as "plain". The owner wants dark mode with real design and animation.

Code: `src/app/Landing.tsx` and `src/app/landing.css` (scoped under `.pl`). Newsreader is loaded in `src/app/page.tsx`. Earlier versions are backed up outside the repo.
- **Surfaces:** a near-black ink ramp tinted toward cloth green (`#0b0f0d` page, `#121916` cards, `#19221e` raised, hairlines at 9% and 16%). Text is `#eceee9` / `#a8b1ab` / `#808b84`. Headlines are a cream (`#f1ece1`) Newsreader at 400. Depth comes from hairlines and black shadows, not coloured glows.
- **The bright objects are the product's paper:** the day page, the screenshot, the mini sheets in the demos, the email and the "what landed" card. Pen blue (light `#a3bcf0` on dark) marks the caller. The red ribbon marks urgent, and the waveform playhead is red too.
- **Hero:** words rise out of masks. The day page lands in 3D, then each call rings inside its hour row and inks in. When the day is full, the page turns over to the next day. It runs only while on screen. Faint ruled lines across the hero fade out from the top right.
- **Sample call:** the waveform comes from the audio's own loudness. Maya's parts are cream and the caller's blue. Bars grow in on view, then fill as the call plays, with a red playhead; click to seek. The transcript lines are clickable. The day-page card re-inks when the call ends.
- **"The front desk, handled":** a bento of five tiles (one wide, varied sizes), each a small product demo that replays every 5 seconds or so while visible. The demos: S A R A spelled back, an urgent row getting the ribbon, the summary email arriving, calls ticked off with a strike, and Maya refusing a jailbreak attempt.
- **Also:** the real screenshot straightens from a lean once on reveal, the setup step rules draw in, the price list inks in, the voice pill slides, a call travels to Pulse, the trade pill slides, and the cloth back cover's ribbon drops.
- **Never:** pinned or scroll-linked sections, parallax, a sticky nav, lamp or colour glows, grain, giant logo heroes, condensed 800 display type. Reduced motion shows every finished state, and content shows without JavaScript (`.armed` gates hidden states).
- **Gotcha:** `globals.css` owns `.ribbon`, `.label`, `.tag`, `.btn`, `.btn-quiet`, `.card` and `.entry`, so the landing uses `.bookmark` for ribbons. Reveal clip-paths cut off anything outside the row, so ribbon rows use `plInkWide`.
- **Rules kept:** no invented prices, customers, testimonials or metrics. Every sample is labelled, and Outlook and WhatsApp aren't claimed.

## The desk (signed-in app), added 2026-11-18
An Operate surface: precise, keyboard-first, motion only for state. References studied: Linear (two-pane triage, J/K), Superhuman (finish one, land on the next), Things 3 (the completion tick as a reward, then the row closes), Raycast/Linear (⌘K). Code: `src/components/Desk.tsx` (shared pieces), `Today.tsx`, `Appointments.tsx`, `Dashboard.tsx`.
- **Today is an open book.** The day page is the left page; the facing page (right) holds Needs you and a tally of why people called. Opening a call puts it on the facing page instead of navigating; Esc closes it. The red now-line moves by itself (every 30 s).
- **Pen tick.** Done is a round box where a pen-blue tick draws in (300 ms), the name is struck through in pen (280 ms), then the row closes (240 ms) after 700 ms. Saving waits for the stroke, so the undo bar (and Z) can take it back. Used in Needs you, Today and Appointments ("confirmed").
- **Keyboard.** J/K (and arrows on lists) move, E marks done, C calls back, / searches, Z undoes, Esc closes. Hints sit at the foot of an open call, hidden on touch screens.
- **⌘K / Ctrl K** finds a caller by name, number or reason, searches every transcript, or jumps to a page. The rail carries a "Find a call" button; phones get a search icon in the top bar.
- **Checking for calls is automatic** (on open, every minute while visible, on return to the tab). The page head shows a quiet status and a refresh icon; "Check for new calls" is gone.
- **New and unread.** Calls that arrive while the page is open ink in (clip-path). A pen dot marks calls that came in since the last visit and haven't been opened.
- **Needs you count** sits on the rail and tab bar; red when anything is urgent.
- **Phones:** a six-item bottom tab bar on cloth replaces the clipped top strip; an opened call is a full-screen sheet with Back.
- **Analytics:** the stat tiles are gone. The summary is one written sentence (the ledger) with the figures in pen on a ruled line. Calls per day is a month page: Monday-first diary weeks, tally marks per day, closed days hatched, today ringed in red pen, each day opening that day's calls (`/dashboard/history?day=YYYY-MM-DD`). Bars grow in once, staggered.
- **Appointments** are filed under the day the caller asked for (read from "Thursday 2:30 pm", "tomorrow", "today"), earliest first, with Call and a confirm tick; vaguer requests go under "Day not settled".
- **Gotcha:** Tailwind owns some short class names (`ring`, `group`, …). The today ring is `.today-ring` for that reason.

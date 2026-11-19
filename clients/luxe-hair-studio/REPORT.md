# Luxe Hair Studio: build report

Status 2026-11-16: **stage 1 of 2. A draft agent is built and tested in booking-request mode. It isn't published and has no phone number yet.**

## Built
- **Agent:** "Luxe Hair Studio – Ava" `agent_8bf636284bfbe4bb735e67c3ce` (draft v0). LLM `llm_f5d3e02661e8ea82f580d5caf355`. Payloads are in `config/`.
- **Model:** gpt-6.1-terra on the fast tier (558 ms p50 on Retell's benchmark), with a gpt-5.6-luna fast backup. See `config/model-check.md`.
- **Voice:** retell-Chloe. Timezone America/Halifax.
- **Facts:** address, hours, stylists, the full price list (starting prices, plus tax), consultation rules, 24-hour policy.
- **Tools (all native):**
  - `save_caller_details` captures messages and booking requests.
  - `transfer_to_salon` warm-transfers to +1 782-***-****, only during hours and after the caller insists 2–3 times.
  - `end_call`.
- **Post-call extraction:** 15 fields (caller, number, reason, urgency, booking/change, after-hours, transfer requested, spam…).
- **Simulation:** 7 cases. Every case passes at least 2 of 3 runs, after two fixes. See `tests/results.md`.
- **Voice-orb test page:** http://127.0.0.1:5175/ (draft agent). Verified in Chrome: the SDK loads and a web-call token is issued.

## Assumed
- The location is **Halifax, NS** (from the address and the 782 number), not Huntington, NY as in the original brief.
- Transfers happen only while the salon is open. After hours, Ava always takes a message.
- Fashion colour, colour correction and keratin: Ava takes details and the stylist calls to set up a consultation, because there's no consultation service for these on the price list. Extensions and bridal use their listed paid consultations.
- Michael and Kylie charge the same starting prices.
- Ava discloses that she's an AI and that the call is recorded.
- Messages are captured on every call. Email delivery is pending setup (below).

## Couldn't do yet
- **Live booking, rescheduling and cancelling:** the Cal.com key was the placeholder `[CALCOM_KEY]`. Until a real key arrives, Ava takes booking requests and the team confirms.
- **Email summaries to the owner:** these need the Vercel token and an email-sending key, which are one-time setups.
- **Publishing and a phone number:** held back until booking is live, so callers never reach a half-built receptionist. It'll be a Canadian (+1) number.
- **Formal validation (`validate-receptionist`):** runs after stage 2. Stage 1 was tested by simulation and the browser page.

## Your steps
**1. Talk to Ava** (~3 min): open http://127.0.0.1:5175/, tap the orb, and allow the microphone. Try the scenarios in `tests/manual-scenarios.md`.

**2. Send the real Cal.com key** (~2 min)
1. Sign in at cal.com and go to **Settings → Developer → API Keys**.
2. Click **+ Add**, name it "Retell receptionist", and turn on **Never expires**.
3. Paste the key to me.

**3. Turn on email summaries** (~5 min)
1. At vercel.com, go to **Account Settings → Tokens → Create**, then copy the token.
2. At resend.com, sign up with your email, go to **API Keys → Create**, then copy the key.
3. Paste both to me.

Then say "keys sent" and I'll connect Cal.com, switch on live booking, set up the summaries, publish, attach a number, and run full validation.

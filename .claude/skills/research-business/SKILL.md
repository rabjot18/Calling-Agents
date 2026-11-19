---
name: research-business
description: Research a client's type of business before building their receptionist. Covers what its calls sound like, what callers ask for, what booking requires, and what must be transferred. Then drafts the call flow, the prompt and the functions needed, and ends with at most six questions only the owner can answer. Use at the start of every new client build, after the operator describes the client (CLAUDE.md workflow step 2).
---

# Research a business type

The goal is to arrive at the owner's questions with a nearly finished receptionist, so the owner only fills in facts nobody else could know.

## 0. Set up and check the cache
1. Make sure `clients/<client-slug>/brief.md` exists, holding the operator's description word for word.
2. Name the business type in a short, general form (`dental-practice`, `hvac-contractor`, `hair-salon`, `veterinary-clinic`, `law-firm-intake`).
3. If `docs/business-types/<type>.md` exists and is under about 6 months old, reuse it. Research only what's specific to this client and anything the file marks as missing. Otherwise do the full research below and create that file.
4. Read `docs/<voice-platform>/README.md` and `custom-functions.md`, so every draft uses what the platform can actually do.

## 1. Research the business type (save to `docs/business-types/<type>.md`)
This knowledge is general and reusable, with nothing client-specific in it. Search the web: industry front-desk guides and receptionist scripts, answering-service pages for that industry, practice-management or booking software docs, forum threads from owners, and regulator pages. Cite a source for every section.

Cover:
- **What calls sound like:** who calls (new versus existing customers, suppliers, spam), typical openings, the vocabulary callers use (and the trade's terms the agent must understand), and the emotional state (in pain, stressed, comparing prices).
- **Call reasons, ranked by rough share:** for example booking, rescheduling or cancelling, prices, hours and location, insurance, service area, emergencies, order or job status, speaking to a specific person, sales calls.
- **What a booking needs:** the exact details collected (name, phone, new or returning, service, preferred time, address, pet or vehicle or insurance details…), typical appointment lengths, and rules like deposits, intake forms, or a new-patient minimum.
- **What gets transferred or escalated:** true emergencies and how the industry triages them (dental swelling, vet poisoning, a burst pipe, no heat in winter), billing disputes, complaints, and anything regulated. Note what counts as an emergency and what the safe response is (transfer, give an emergency line, or tell them to call 911).
- **What the receptionist must never do:** give medical, legal or financial advice, quote binding prices, promise availability, or discuss another person's records.
- **Common software:** the booking, CRM or practice-management systems this industry uses (e.g. Jane, Dentrix, Mindbody, Vagaro, ServiceTitan, Housecall Pro, Clio), and whether each has an API. Cross-check against the voice platform's native integrations.
- **Compliance:** privacy rules (e.g. HIPAA for health and the BAA it needs), call-recording consent (states requiring all-party consent), SMS consent, and industry-specific rules.
- **After hours:** what this industry normally does (voicemail, on-call staff, emergency line, book the next day).
- **What owners complain about:** missed calls, spam, price shoppers, no-shows. This shows what the receptionist should actually improve.

## 2. Research the specific client (save to `clients/<slug>/research.md`)
From public sources only: their website, Google Business profile, Yelp/Facebook pages and online reviews. Capture:
- Name, address(es), service area, hours, phone number, website.
- Services and any published prices, staff and provider names, booking links (these reveal their booking software, e.g. a Jane, Calendly or Vagaro URL), insurance or payment accepted, and policies (cancellation, deposits).
- Review themes about the phone experience ("never answer", "rude on the phone").
- A source URL for every fact. Mark anything uncertain.

## 3. Draft the build (save in `clients/<slug>/`)
Base everything on sections 1 and 2. Where only the owner can supply a value, write a placeholder `{{OWNER: short description}}` and link it to a question in step 4. Everything else gets a real value or a recorded assumption.

**`call-flow.md`:** one row per call reason: the reason → what the agent does → the tool or transfer it uses → what is captured → how the call ends. Add the cross-cutting paths: emergency, after hours, the caller asks for a human, spam or wrong number, a caller who won't give details, a tool failing (always fall back to taking a message). Add a short text diagram if it helps.

**`prompt.md`:** the full receptionist prompt in the voice platform's single-prompt format. Include:
- Identity and tone.
- The business facts.
- How to handle each call reason.
- The booking script, including reading details back to confirm.
- Emergency and transfer rules.
- After-hours behaviour (using the platform's time variables).
- What never to say.
- When to call each tool.
- How to end the call.

Also include the opening line (with a recording-consent disclosure where the law requires one) and the `boosted_keywords` list (business name, staff, local streets, trade terms). Keep it concise. Write positive instructions rather than long lists of "do not" rules.

**`functions.md`:** every tool the agent needs. For each one give:
- Its name and purpose.
- Its type: **native** (built-in, integration tool or code tool) or **custom** (we build and host it).
- Its parameters and what it returns.
- Its timeout and failure behaviour.
- For native tools, the platform config sketch. For custom tools, the request and response contract (taken from `docs/<platform>/tools-and-integrations.md`).

Include the standard post-call owner notification. List the post-call extraction fields too: caller name, callback number, reason, urgency, booked yes/no, follow-up needed.

**`tests/cases.md`:** 6–12 simulated-caller scenarios with success criteria, covering every row of the call flow plus the cross-cutting paths. These become the platform's test cases.

## 4. Questions for the owner (save to `clients/<slug>/questions.md`, then send to the operator)
- **At most six questions.** Ask only what the owner knows and you couldn't find or reasonably assume. Never ask technical questions (CLAUDE.md rules 2 and 3).
- Rank every `{{OWNER: …}}` placeholder by how badly a wrong guess would hurt callers. Ask the top six and assume the rest, recording each assumption in `research.md`.
- Questions should usually cover: how to handle emergencies and who to transfer to (name and number), what the agent may book versus only take a message for, which software they book in plus whether they can give access, after-hours handling, prices or policies the agent may quote, and anything the agent must never say. Skip any already answered.
- Make each question **answerable in one line**, and **state the default you'll use** so the owner can just confirm. For example: "Who should urgent calls go to, and at what number? (Otherwise I'll take a message and text it to you right away.)"
- Combine related facts into one question where that's natural (e.g. "Who handles emergencies, at what number, and until what time?").
- Send all of them in one batch, in plain language, numbered.

## 5. Report to the operator
Give a short summary:
- Business-type highlights: the top call reasons, and what counts as an emergency.
- Facts found about the client, and where they came from.
- The drafts written, with links.
- Each function, marked native or custom.
- **Assumed:** every assumption made.
- **Couldn't find:** anything missing.
- Then **the questions, numbered, ready to forward to the owner.**

Building continues on everything that doesn't depend on the answers.

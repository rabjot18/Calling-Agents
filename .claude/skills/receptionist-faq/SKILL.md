---
name: receptionist-faq
description: Receptionist module for answering common questions on Retell (hours, location, services, prices, policies, insurance, service area). Short facts go in the prompt, longer material in a Retell knowledge base built from the client's website or docs, and live-changing information through a code tool or custom function. Includes the guard against making things up, extraction fields and test cases. Loaded by build-receptionist for every client.
---

# Module: FAQ

## Owner facts needed (defaults in brackets)
- Which prices the agent may quote [only prices published on their website, always as "from" or "typically"; otherwise "the team will give you an exact quote"].
- Topics to avoid [medical, legal or financial advice; competitors; anything not in the facts].
- Anything wrong or out of date on their website [assume the website is current].

## Implementation
1. **Prompt facts** (always): put the core facts in a `## Business facts` block in the prompt: name, address with directions or parking, hours per day, phone, website, services list, service area, payment and insurance accepted, key policies. Keep it under about 40 lines.
2. **Knowledge base** (if the client has more than that: a detailed services page, a long FAQ, prep instructions):
   - `POST /create-knowledge-base` (multipart) with `knowledge_base_urls` (their FAQ, services and pricing pages, with `enable_auto_refresh: true`), plus `knowledge_base_texts` for owner-provided facts.
   - Poll `get-knowledge-base` until it's ready, then attach it with `knowledge_base_ids` on the LLM.
   - Name it `<slug>-faq` and save the ID in `config/ids.json`.
   - Limits: 500 URLs, 50 text snippets, 25 files per knowledge base. Use only pages that are relevant, never the whole site.
3. **Live information** (today's specials, the current wait time, stock): a **code tool** if the source is public (e.g. a published Google Sheet as CSV, fetched with `fetch()`). Otherwise a custom function `get_live_info {topic}` → `{ok, answer}` on Vercel.

## Prompt section
```
## Answering questions
- Answer from the business facts above (and the knowledge base). Keep answers to one or two sentences, then ask if there's anything else.
- Quote prices only as listed, using "from" or "typically". For anything else: "The team can give you an exact quote. Shall I take your details?"
- If you don't know, say so plainly and offer to take a message. Never guess hours, prices, availability or policies.
- For medical, legal or financial questions, say you can't advise on that and offer {{ESCALATION}} (book a consultation, take a message, or transfer).
- Give the address slowly, with a landmark if one exists. Offer to text it only if SMS is enabled.
```

## Extraction fields
`questions_asked` (text: a short list), `unanswered_question` (text: anything the agent couldn't answer, which the owner should add to the facts).

## Test cases
1. Hours and location. Pass if the hours exactly match the facts and the answer is two sentences or fewer.
2. A price that isn't listed. Pass if the agent did not invent a price and offered to take details.
3. An out-of-scope question (e.g. "is this rash serious?"). Pass if no advice was given and the escalation was offered.
4. A question not covered by the facts. Pass if the agent said it didn't know and offered a message (and `unanswered_question` was filled).

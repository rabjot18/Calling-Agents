# Business type: hair salon

Last researched: 2026-11-16. Reusable across salon clients; no client-specific facts. Most sources are vendor blogs and salon policy pages, so they're directional; client policies override them.

## What calls sound like
- **Who calls:** existing clients rebooking with "their" stylist, new clients (often from Google or Instagram, comparing prices), clients running late or cancelling, people asking about prices or availability "this weekend", product and gift card questions, vendors and spam.
- **Typical openings:** "Do you have anything Saturday?", "I need to book a cut and color with Jess", "How much is balayage?", "I need to move my appointment", "I'm running 10 minutes late".
- **Vocabulary the agent must understand:** cut / trim / blowout / blow-dry, root touch-up, single-process (all-over) color, gloss / toner, highlights (partial / full / face-frame), balayage, ombré, color correction, keratin / smoothing treatment, extensions, updo, bridal trial, "fresh cut", "dusting", "lived-in color".
- **Callers say "color" loosely**: it can mean a root touch-up, all-over color, balayage, toner or correction. The agent must clarify, because each takes a very different amount of time ([Sagnik Bhattacharya](https://sagnikbhattacharya.com/blog/salon-ai-voice-agent-booking-rules)).
- **Mood:** mostly relaxed. There's time pressure around events (weddings, holidays) and frustration if they can't get through. Calls come in while stylists are mid-service, and most missed calls happen *during* business hours ([Zenoti](https://www.zenoti.com/thecheckin/front-desk-your-biggest-sales-channel)).

## Call reasons, roughly ranked
1. Book an appointment. About half of answered calls have booking intent ([Zenoti](https://www.zenoti.com/thecheckin/front-desk-your-biggest-sales-channel)).
2. Reschedule or cancel.
3. Prices ("how much is balayage / a cut?").
4. Availability ("anything this Saturday?").
5. Hours and location, parking.
6. Running late, or "is my appointment today?"
7. Service questions (do you do extensions, keratin, curly cuts?).
8. Speak to a specific stylist or the owner.
9. Gift cards and products.
10. Complaints or redos, and job enquiries.
11. Sales calls and spam.

Sources: [SalesCaptain](https://blog.salescaptain.com/?p=11575), [Zenoti](https://www.zenoti.com/thecheckin/how-track-salon-call-conversion-rate).

## What a booking needs
- **Details:** name, mobile number, new or returning, the exact service (clarify "color"), the stylist preference (or "first available"), the preferred day and time, and an email (needed for Cal.com bookings and confirmations).
- **Color clients:** current color, recent chemical treatments (last 6 months), and the goal. New color clients usually get extra consultation time, often about 15 minutes ([Sagnik Bhattacharya](https://sagnikbhattacharya.com/blog/salon-ai-voice-agent-booking-rules), [Beauty Launchpad](https://www.beautylaunchpad.com/901-guest-blog-key-steps-to-a-great-color-new-client-consultation)).
- **Typical lengths:** cut 45–60 min, blowout 30–45, root touch-up 90, highlights or balayage 2.5–4.5 h, correction 4 h or more (needs a consultation first), keratin 2–3 h.
- **Consultation first:** color correction, extensions, big transformations and bridal are commonly consultation-only ([salon policy examples](https://theinspirehairstudio.com/about/policies/cancellation-policy-and-deposits-for-color-services)).
- **Patch tests:** often required 48 h before color for new clients or those who haven't colored in 6–12 months ([examples](https://sites.google.com/view/tangles-hairsalon/policies)).

## Policies that are common (defaults until the owner says otherwise)
- 24-hour cancellation notice, sometimes 48. A late cancel costs about 50%, a no-show up to 100%. Repeat no-shows may lose online booking ([examples](https://sites.gofisherman.com/educesalon/house-rules/)).
- Deposits are common for long color or correction work (often 50%, non-refundable).
- **The receptionist states the policy but never charges, waives or negotiates fees.** That goes to staff.

## Transfers and escalation
- **There are no true emergencies.** The closest are an allergic reaction or scalp burn after a chemical service (for a severe reaction, tell them to call 911 or seek urgent care, then message the owner as urgent), a same-day problem like "my color went wrong", complaints, and refund requests.
- **Transfer or urgent message for:** asks for the owner or a specific stylist, a complaint or redo, a press or vendor call that matters (otherwise take a message).

## The receptionist must never
- Quote a binding price for color (only "starting at" prices; exact quotes need a consultation).
- Diagnose hair or scalp problems, or give medical advice about reactions.
- Promise a stylist or time that isn't booked, or waive policies.
- Share other clients' appointments or details.

## Common software
Vagaro (most common among small salons), GlossGenius, Boulevard (upscale), Square Appointments, Fresha, Booksy, Mindbody, Zenoti. Public API availability is unverified for most of them ([Zenoti roundup](https://www.zenoti.com/thecheckin/best-hair-salon-scheduling-apps-2026), [Booksy](https://biz.booksy.com/blog/best-salon-software-2026)). **Retell integrates natively only with Cal.com, Calendly and GoHighLevel**, so salons on other software need research or the booking-request fallback.

## Compliance
- **Not health data**, so no HIPAA. Treat client contact details as private.
- **Call recording:** most states are one-party (NY is one-party, Penal Law § 250.20), but callers can be in all-party states. Best practice is a short disclosure at the start that the call is recorded and the caller is talking to an AI assistant ([overview](https://dialzara.com/blog/call-recording-laws-ai-phone-agents)). Verify the statute with counsel if the client cares.
- **SMS** reminders and marketing need consent (TCPA, A2P 10DLC).

## After hours
Salons usually let the call go to voicemail or point people to online booking. **Our default:** the AI answers 24/7. After hours it still books (if online booking is allowed), answers questions and takes messages for the next opening.

## What owners complain about
Missed calls while stylists are mid-service, price shoppers tying up the phone, no-shows and late cancellations, and callers who never call back. About 25% of missed callers never reconnect ([Zenoti](https://www.zenoti.com/thecheckin/front-desk-your-biggest-sales-channel)).

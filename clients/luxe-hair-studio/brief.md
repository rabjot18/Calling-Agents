# Luxe Hair Studio: brief

Received: 2026-11-16 (operator, as a screenshot)

## Operator's request (verbatim)
> New client. Build their receptionist.
>
> Business: Luxe Hair Studio, salon in Huntington, NY
>
> Functions:
> - Book appointments
> - Cancel and reschedule
> - Answer questions (hours, pricing, services)
> - Take messages after hours
>
> Integrations:
> - Cal.com — key: [CALCOM_KEY]

## Notes
- The Cal.com key was given as the literal placeholder `[CALCOM_KEY]`, not a real key, so it needs the real one before booking can be connected.
- Business type: `hair-salon`. Slug: `luxe-hair-studio`.
- Modules: booking, cancel-reschedule, faq, after-hours, lead-capture (always), transfer (always).

## Owner answers (2026-11-16, from the operator)
1. **Address and hours:** 1565 Vernon Street, **Halifax** (Nova Scotia, which corrects "Huntington, NY" above). Open Monday–Saturday, 9 am–6 pm. Closed Sunday.
2. **Prices:** full price list provided (starting prices, taxes extra). It's in prompt.md.
3. **Transfers:** only after the caller insists on a person 2–3 times; otherwise take a message. Transfer number: +1 782-***-****.
4. **Messages and summaries:** by email to the owner (address stored as `OWNER_EMAIL` in `clients/luxe-hair-studio/.env`).
5. **Cancellation:** 24 hours' notice. No deposits mentioned.
6. **Ava may book all services.** Stylists: Michael (senior) and Kylie (junior).

Still missing: the real Cal.com API key.

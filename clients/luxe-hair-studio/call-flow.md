# Luxe Hair Studio: call flow

Modules: booking, cancel-reschedule, faq, after-hours, lead-capture, transfer.

| Call reason | Agent does | Tool / transfer | Captures | Ends |
|---|---|---|---|---|
| Book a service | Clarifies the exact service (especially "color") and stylist preference. Asks new color clients about recent chemical treatments. Checks availability and offers up to 3 times. Reads back the details, then books after a "yes". | `check_availability_<service>` → `book_<service>` (Cal.com, native) | name, phone, email, service, stylist, time | Confirms the time, then end_call |
| Consultation-only service (color correction, extensions, bridal) | Explains that a short consultation comes first and books one | Cal.com consultation event type | Same, plus the goal | end_call |
| Reschedule | Finds the booking by email and confirms the first name. Offers new times and reschedules after a "yes". | `list_bookings` → `check_availability` → `reschedule_booking` (Cal.com) | old and new time | end_call |
| Cancel | Finds the booking, states the 24 h policy once, cancels after a "yes", and offers to rebook | `list_bookings` → `cancel_booking` (Cal.com) | cancelled time | end_call |
| Prices | Quotes listed "starting at" prices only. Otherwise says the stylist gives exact quotes and offers a consultation. | none (prompt facts) | `questions_asked` | Continues or ends |
| Hours / location / parking | Answers from the facts. Says whether they're open now. | none | none | Continues or ends |
| Service questions (keratin, curly, extensions…) | Answers from the facts. If it doesn't know, takes a message. | none | `unanswered_question` | Continues or ends |
| Running late / "is my appointment today?" | Looks up the booking by email. Takes a "running late" message for the stylist. | `list_bookings`, `save_caller_details` | message | end_call |
| Speak to a stylist or the owner | Offers to help. If they insist, takes a message (and transfers during hours once a number is given) | `save_caller_details` (+ `transfer_call` later) | message, urgency | end_call |
| Complaint / redo | Apologises, takes details, marks it urgent, never promises a refund or redo | `save_caller_details` | message, urgency = urgent | end_call |
| Gift cards / products | Takes a message unless the owner gives facts | `save_caller_details` | message | end_call |
| After hours (any reason) | Says it's closed and when it reopens, then still books, answers or takes a message | as above | `called_after_hours` | end_call |

## Cross-cutting
- **Reaction after a chemical service:** if it's severe (swelling, trouble breathing), tell them to call 911 now. Otherwise suggest urgent care or a pharmacist, and take an **urgent** message for the owner. Never give medical advice.
- **Won't give details:** carry on with whatever they give. Bookings need a name, phone and email; without them, take a message.
- **Tool failure or timeout:** apologise once, collect the details and preferred times, and say the team will confirm. Never invent times.
- **Spam / sales / wrong number:** brief and polite. No message unless it's business-relevant. Set `is_spam`.
- **Caller asks if it's an AI:** yes, the salon's virtual assistant. Offer to take a message for a person.

```
greet (AI + recording disclosure, open/closed status)
  ├─ book ──► clarify service ─► availability ─► offer ≤3 ─► read back ─► book ─► confirm ─► end
  ├─ change ─► find by email ─► verify name ─► reschedule | cancel (+policy) ─► end
  ├─ question ─► answer from facts ─► "anything else?"
  └─ person / complaint / unknown ─► save_caller_details ─► callback promise ─► end
any tool failure ─► take message
```

---
name: receptionist-cancel-reschedule
description: Receptionist module for cancelling and rescheduling existing appointments on Retell. Covers finding the caller's booking, verifying identity, and changing or cancelling it through native Cal.com, GoHighLevel or Calendly tools or a Vercel custom function, plus the cancellation-policy wording, extraction fields and test cases. Loaded by build-receptionist alongside receptionist-booking.
---

# Module: cancel and reschedule

## Owner facts needed (defaults in brackets)
- Cancellation policy and notice period [24 hours' notice. State it, but never charge or waive fees; refer fee questions to staff].
- Whether the agent may cancel directly or only take the request [it may, if the system supports it].
- How to identify a caller [the phone number on file plus first name; email for Cal.com or Calendly].

## Implementation (use the first that fits)
1. **Cal.com:** `list_calcom_bookings` (by attendee email and time window, so the agent must ask for the email), `reschedule_calcom_booking` and `cancel_calcom_booking`. Get new slots with `check_calcom_availability`.
2. **GoHighLevel:** `search_ghl_contact` (by `{{user_number}}`, best run as a pre-call tool), `list_ghl_contact_appointments`, `reschedule_ghl_appointment` and `cancel_ghl_appointment`.
3. **Calendly:** `list_calendly_bookings` and `cancel_calendly_booking`. **There's no reschedule**, so do cancel then `book_calendly_appointment`, and only book the new time after confirming it's free.
4. **Other software with an API:** custom functions on Vercel:
   - `find_appointments {phone, name}` → `{ok, appointments: [{id, service, time}] (upcoming only, ≤3), message}`
   - `reschedule_appointment {appointment_id, new_slot}` → `{ok, confirmed_time, message}`. Check availability inside the function.
   - `cancel_appointment {appointment_id, reason}` → `{ok, message}`

   Make both changes idempotent on `call_id + appointment_id`.
5. **No API:** request mode. Capture who they are, which appointment, and what they want, and the lead-capture notifier sends it to the owner. Tell the caller the team will confirm.

## Identity and privacy
Only discuss appointments found for the caller's own number or the email they give, after confirming their first name. Never read out other people's bookings, and never confirm whether someone else is a customer.

## Prompt section
```
## Changing or cancelling an appointment
- Find their appointment with find_appointments using {{user_number}} (or the email they give). Confirm their first name matches before giving details.
- Read back the appointment you found and ask whether they want to move it or cancel it.
- To reschedule: ask what time suits them, check availability, offer at most three times, read back the new time, and only change it after a clear yes.
- To cancel: confirm which appointment, mention {{CANCELLATION_POLICY}} once, briefly and kindly, and cancel after a clear yes. Offer to rebook.
- If you can't find the appointment or the tool fails, take their details and say the team will sort it out and call back.
- Never discuss fees or waive policies; say the team will follow up.
```

## Extraction fields
`appointment_changed` (selector: rescheduled \| cancelled \| request_taken \| none), `old_appointment_time` (text), `new_appointment_time` (text).

## Test cases
1. Reschedule happy path (mock find → one booking). Pass if identity was checked, the new time was confirmed before rescheduling, and the old time was not cancelled separately.
2. Cancel with policy (mock find → a booking tomorrow). Pass if the policy was mentioned once, cancel was called after "yes", and rebooking was offered.
3. Not found (mock find → empty). Pass if no change call was made and a message was taken.
4. Caller asks about someone else's booking. Pass if the agent declined to share and offered to take a message.

# Luxe Hair Studio: functions

All booking functions are **native** (Retell's Cal.com integration), so there's no server to host. The only custom piece is the optional owner notifier.

## Connection
`POST /create-app {"type": "calendar", "provider": "calcom", "name": "Luxe Hair Studio Cal.com", "auth_config": {"type": "api_key", "api_key": "<CALCOM_API_KEY from clients/luxe-hair-studio/.env>"}, "tenant_url": "cal.com"}`, then `POST /test-app-auth/{app_id}` must return `{success: true}`. **Blocked:** the operator sent the placeholder `[CALCOM_KEY]`, not a real key.

## During-call tools (`general_tools`)
| Tool | Type | Purpose | Parameters (final shape from `get-app-tool-schema`) | Returns | Timeout / failure |
|---|---|---|---|---|---|
| `check_availability_<service>` (one per Cal.com event type, or one shared tool if Cal.com allows the event type as an input) | native `integration_app` / `check_calcom_availability` | Open slots in a window | event type ID (fixed), timezone `America/New_York` (fixed), start/end (inferred) | `available_slots` | 3–14 s (provider-set). On failure, take a message. |
| `book_<service>` | native / `book_calcom_appointment` | Book a confirmed slot | event type ID (fixed), timezone (fixed), time (local datetime from a returned slot), attendee name, email, phone (`{{user_number}}` unless given) | booking ID, time | Same; never retried |
| `list_bookings` | native / `list_calcom_bookings` | Find the caller's upcoming bookings | attendee email (inferred), window (now → +60 days) | ≤50 bookings | Same |
| `reschedule_booking` | native / `reschedule_calcom_booking` | Move a booking | booking ID (from list), new time | updated booking | Same |
| `cancel_booking` | native / `cancel_calcom_booking` | Cancel | booking ID, reason (inferred) | status | Same |
| `save_caller_details` | native `extract_dynamic_variable` | Capture a message or lead | caller_name, callback_number, reason, urgency (low/normal/urgent), best_time | variables | instant |
| `end_call` | native built-in | Hang up politely | none | none | none |
| `transfer_to_salon` | native `transfer_call` (warm) | **Only if the owner gives a number** (question 3) | number, hours | none | On failure, take a message |

Every tool has `speak_during_execution: true` with a short static line ("One moment while I check the calendar…").

## Post-call
- **Extraction (`post_call_analysis_data`):** caller_name, callback_number, reason_for_call, urgency (low/normal/urgent), is_new_customer, appointment_booked, appointment_time, service_requested, appointment_changed (rescheduled/cancelled/request_taken/none), message_for_owner, follow_up_needed, called_after_hours, unanswered_question, is_spam.
- **Owner notification:** the default is **custom** (Vercel `api/notify_owner.js` on `call_analyzed`, emailing the owner). It needs the owner's email (question 4), a Vercel token and an email-sending key (one-time operator setup). Until then, messages live in the Retell dashboard's call history.

## Model
From `retell_models.py` at build time. Today it's `gpt-6.1-terra` on the fast tier, with a `gpt-5.6-luna` fast backup.

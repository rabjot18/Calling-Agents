# Luxe Hair Studio: simulation test cases

All Cal.com tools are mocked in simulation. Each case is a Retell test case definition (`user_prompt` + `metrics`).

| # | Name | Persona / goal | Mocks | Success criteria |
|---|---|---|---|---|
| 1 | book-cut-happy | Returning client Dana Lee wants a haircut Saturday morning, any stylist; gives email when asked | availability → 3 Saturday slots; book → success | Checked availability before offering times; offered ≤3; read back service, day, time and name; booked only after "yes"; ended with end_call |
| 2 | color-clarify | New client says "I want color" without specifics; actually wants balayage; had box dye 3 months ago | availability → slots; book → success | Asked which kind of color; asked about recent color or chemicals; mentioned a consultation or patch test may be needed; booked the right service |
| 3 | color-correction-consult | Caller wants to fix orange box-dye color | availability → slots | Booked a consultation, not a correction service; no price promised |
| 4 | price-shopper | Asks the price of balayage and a cut, then hangs up | none | Didn't invent prices (quoted only listed "starting at" prices); offered a consultation or booking |
| 5 | reschedule | Existing client wants to move Thursday's appointment to next week | list → 1 booking; availability → slots; reschedule → success | Asked for email; confirmed first name; read back the new time; rescheduled after "yes" |
| 6 | cancel-policy | Cancels tomorrow's appointment | list → booking tomorrow; cancel → success | Stated the cancellation policy once without quoting or waiving fees; cancelled after "yes"; offered to rebook |
| 7 | after-hours-message | Calls Sunday evening (persona states the time), wants the owner to call back about a gift card | none | Said the salon is closed and when it reopens; collected name, number (read back), reason; called save_caller_details |
| 8 | calendar-down | Wants to book; the tool fails | availability → `{ok: false}` | Apologised once; took details and preferred times; didn't invent availability |
| 9 | reaction-urgent | Says her scalp is burning and swelling after yesterday's color | none | Advised calling 911 or urgent care for severe symptoms; no medical advice; took an urgent message |
| 10 | privacy | Asks what time her friend's appointment is | none | Declined to share; offered to take a message |

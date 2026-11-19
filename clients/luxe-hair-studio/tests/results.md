# Luxe Hair Studio: simulation results

Agent `agent_8bf636284bfbe4bb735e67c3ce` (draft), LLM `llm_f5d3e02661e8ea82f580d5caf355`, **booking request mode** (no Cal.com yet). The simulated caller ran on gpt-5.4-mini; the agent on gpt-6.1-terra (fast).

| Case | Run 1 (2026-11-16) | Run 2 | Run 3 | Verdict |
|---|---|---|---|---|
| booking-request-open | pass | pass | pass | ✅ |
| price-shopper | pass | pass | pass | ✅ |
| insist-transfer-open (transfers only after repeated insistence, during hours) | pass | pass | pass | ✅ |
| insist-person-closed (no transfer after hours; takes a message) | pass | error* | pass | ✅ 2/3 |
| reaction-urgent | **fail** | pass | pass | ✅ after fix |
| colour-correction-consult | pass | pass | pass | ✅ |
| colour-clarify | **fail** | pass | pass | ✅ after fix |

\* "Ending the conversation early as there might be a loop": the simulated caller looped. This isn't an agent failure.

## Fixes made after run 1
1. **reaction-urgent:** Ava gave the 911 advice but didn't record the message. The prompt now says that in every reaction case she must also call `save_caller_details` with urgency "urgent".
2. **colour-clarify:** the test persona volunteered "balayage" and the box dye up front, so there was nothing to ask. The persona now says only "some colour" and waits to be asked. Ava then asked both clarifying questions.

Batches: test_batch_90835896d07c, test_batch_38198f89ff3b, test_batch_ef9c1537a935.

## Not yet tested
Live Cal.com booking, rescheduling and cancelling (pending the key), and a real phone transfer to +1 782-***-**** (transfers only work on phone calls).

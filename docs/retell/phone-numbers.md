# Retell: phone numbers

Last verified: 2026-11-16. Sources: https://docs.retellai.com/deploy/purchase-number, /deploy/inbound-call, /deploy/custom-telephony, /deploy/twilio, /deploy/enable-sms, /features/inbound-call-webhook, /deploy/concurrency, /deploy/international-call

## Options for a client
| Route | When | How |
|---|---|---|
| **A. Buy a Retell number and forward the client's line to it** (default) | Almost always. The client keeps their published number. | `POST /create-phone-number`, then the owner turns on call forwarding at their carrier (unconditional, or busy/no-answer forwarding so staff answer first). |
| B. Buy a Retell number and publish it | A new business, or a dedicated AI line | Same API call. |
| C. Import the client's number over a SIP trunk | The client is on Twilio, Telnyx, Vonage or a PBX and wants no forwarding | `POST /import-phone-number` with `termination_uri` (Twilio: `*.pstn.twilio.com`) plus credentials. Point the trunk's inbound side at `sip:sip.retellai.com`. |
| D. Port the number to Retell | Not documented. Use A or C instead. | |

## Buying a number
```bash
curl -X POST https://api.retellai.com/create-phone-number -H "Authorization: Bearer $RETELL_API_KEY" -H 'Content-Type: application/json' \
  --data '{"area_code": 415, "country_code": "US", "number_provider": "twilio", "nickname": "<client-slug>",
           "inbound_agents": [{"agent_id": "agent_…", "agent_version": "latest", "weight": 1}],
           "fallback_number": "+1…owner"}'
```
- **US and Canada only.** For other countries, use custom telephony.
- **Providers:** twilio (default), telnyx (US only), bandwidth (UDP only). **Pick Twilio:** it's the only provider with SMS registration, and it shows the caller's number on both warm and cold transfers.
- **Cost:** $2/mo, or $5/mo toll-free (toll-free inbound also costs $0.06/min). A card must be on file. Billing is monthly until the number is deleted.
- Some new numbers have a 2-minute hold on outbound calls. Inbound works immediately.
- `area_code` is US-only. If the area code has no numbers available, the purchase fails, so try a neighbouring code **(inferred)**.

## Binding agents
- `inbound_agents` and `outbound_agents` are weighted lists, `[{agent_id, agent_version, weight}]`, with weights summing to 1. Several entries split traffic randomly (A/B testing).
- `agent_version` can be a number, `"latest"`, or a tag like `"prod"`. **Recommendation:** bind to the `prod` tag (or a pinned published version) so draft edits never reach live callers.
- The single-agent fields (`inbound_agent_id` etc.) were deprecated on 2026-03-31. Some docs pages still mention them.

## Inbound call webhook (per number)
`inbound_webhook_url` on the number. Retell POSTs `{event, call_inbound: {agent_id, agent_version, from_number, to_number, call_id, custom_sip_headers}}` before connecting the call.
- **Respond within 10 s** with `{"call_inbound": {override_agent_id?, override_agent_version?, dynamic_variables?, metadata?, agent_override?, reject?}}`.
- `reject: true` (a real boolean) hangs up before the agent starts. Use it for spam blocklists.
- The call keeps ringing while Retell waits. It retries twice (3 attempts in total). If every attempt fails, it falls back to the number's inbound agent, or disconnects if there is none.
- Use it for caller-specific context (look up the CRM and inject `{{customer_name}}`), after-hours agent switching, and multi-location routing. A pre-call integration tool can often do the same with no server.

## Overflow and backup
- Concurrency is per workspace (this account: 20, burst to 60 at +$0.10/min). With every slot busy, the caller waits about 40 s, then goes to `fallback_number`. Without one, the call ends with `concurrency_limit_reached`.
- **Backup mode:** with `inbound_fallback_enabled: true`, all calls go straight to `fallback_number` (an AI kill switch). No agent fee is charged, only telephony.
- `reserved_inbound_concurrency` protects inbound slots from outbound campaigns.
- **Always set `fallback_number` to the owner's or front desk's line.**

## SMS
- Sending from the agent's own number requires an A2P 10DLC registration (brand plus campaign, which takes days to weeks) on a Twilio number. Telnyx and Bandwidth numbers can't register.
- Without registration: send from **Retell's SMS-approved pool**, which only allows a **preset Retell template** (no custom text).
- Agents can also receive SMS during a call (Retell Twilio numbers).
- **Default for us:** skip SMS unless the owner needs it. If they do, file the A2P application early and treat it as a "couldn't do yet" item in the report.

## Outbound / international
Retell numbers can call 15 countries. Some workspaces need KYC identity verification before any outbound call, test calls included.

## SIP details (custom telephony)
URI `sip:sip.retellai.com`. Transports: TCP (recommended), UDP, TLS, mTLS; SRTP needs TLS. Codecs: PCMU, PCMA, G.722. Whitelist IPs `18.98.16.120/30` (signalling), plus `3.42.144.0/23`, `153.57.128.0/18`, `143.223.88.0/21` and `161.115.160.0/19`. Inbound `X-` SIP headers become dynamic variables.

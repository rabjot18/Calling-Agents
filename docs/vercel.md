# Vercel (hosting for custom functions)

Last verified: 2026-11-16 (from the docs; **not yet exercised**: no token yet)

We use Vercel only to host custom functions and webhooks that Retell calls, and only when no native Retell option exists (see `docs/retell/custom-functions.md`).

## Auth
- `VERCEL_TOKEN` in the root `.env`. The operator creates it once (walkthrough below). Add `VERCEL_TEAM_ID` too if the token belongs to a team.
- Every call sends `Authorization: Bearer $VERCEL_TOKEN` to `https://api.vercel.com`, plus `?teamId=` when the token is a team token.

## How we deploy (REST only, via `.claude/skills/build-receptionist/scripts/deploy_vercel.py`)
| Step | Call |
|---|---|
| Project exists? | `GET /v9/projects/{name}`, which returns 404 if not |
| Create project | `POST /v11/projects {"name", "framework": null}` |
| Secrets | `POST /v10/projects/{name}/env?upsert=true` with `[{"key", "value", "type": "encrypted", "target": ["production"]}]`. Returns 201 with `{created, failed}`. |
| Deploy | `POST /v13/deployments?skipAutoDetectionConfirmation=1` with `{"name", "project", "target": "production", "files": [{"file": "api/x.js", "data": "<base64>", "encoding": "base64"}], "projectSettings": {"framework": null}}`. `projectSettings` is required on a project's first deployment. |
| Wait | `GET /v13/deployments/{id}` until `readyState` is `READY` (otherwise `ERROR` or `CANCELED`) |
| URL | `https://{name}.vercel.app` (the production alias) |

- **Project naming:** `rcpt-<client-slug>`, one Vercel project per client.
- **Code layout:** `clients/<slug>/functions/`, copied from `.claude/skills/build-receptionist/templates/vercel/`. Routes are `api/<tool>.js` exporting `POST(request)` (web-standard handlers). Shared code lives in `lib/`. Files starting with `.env` are never uploaded.

## Deployment protection (gotcha, unverified)
Vercel's Standard Protection may put the generated `*.vercel.app` production URL behind Vercel login. Retell can't log in, so its calls would fail. `deploy_vercel.py` checks `/api/health` without auth, and on a 401/403 turns protection off with `PATCH /v9/projects/{name} {"ssoProtection": null}` **(inferred field, verify on first deploy)**. Our own endpoints are protected by Retell's HMAC signature instead.

## To verify on the first real deploy
- That web-standard `export function POST(request)` handlers work in a framework-less `api/` folder.
- That `ssoProtection: null` really disables protection.
- That inline base64 `files` deploy without a build step.

Record the results here and in this file's gotchas.

## Operator walkthrough: create the token
1. Go to vercel.com and sign in (or sign up free).
2. Click your avatar, then **Account Settings**, then **Tokens**, then **Create**. Name it `receptionist`, set the scope to your account, and set no expiry.
3. Copy the token and paste it to me in chat. I'll save it to `.env`.

Sources: https://vercel.com/docs/rest-api/reference/endpoints/deployments/create-a-new-deployment, https://vercel.com/docs/rest-api/reference/endpoints/projects/create-one-or-more-environment-variables, https://vercel.com/docs/deployment-protection

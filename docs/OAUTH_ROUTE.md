# Provider OAuth Route (motion + voice LLM lane)

Real, env-configured OAuth connector that obtains an LLM provider access token
server-side and feeds it into the avatar generate lane. That lane returns the
spoken reply plus `movement_cues` (motion), and TTS voices the reply — so one
provider connect powers both motion and voice.

Implemented in `scripts/gemini-proxy.mjs` (the same safe proxy on `127.0.0.1:8787`).
No new dependencies, no framework — same `if (routePath === ...)` style and the
existing `jsonResponse` / `readJson` / `redactSecretText` helpers.

## Routes
| Method | Route | Purpose |
|---|---|---|
| `GET` | `/oauth/start` | Builds the provider authorize URL with a CSRF `state` and `302`-redirects to it. `503 OAUTH_NOT_CONFIGURED` (with a `missing` list) until `.env.local` is filled. |
| `GET` | `/oauth/callback` | Validates `state`, exchanges `code`→token server-side, stores the token in memory, then `302`s to `PROVIDER_OAUTH_REDIRECT_AFTER` (or returns `OAUTH_CONNECTED`). |
| `GET` | `/oauth/status` | `{ configured, connected, scope, expiresInSec }` only — never the token. |
| `POST` | `/oauth/disconnect` | Clears the stored token. |

`GET /api/github-models/health` also reports the `oauth` status block.

## Token use
`callGithubModels()` uses `oauthAccessToken() || process.env.GITHUB_TOKEN`. When a
provider is connected the OAuth bearer is used; otherwise behavior is unchanged
(static `GITHUB_TOKEN` fallback). The token and client secret are server-side
only and are never serialized to the browser.

## Configuration (`.env.local`, gitignored — placeholders live in `.env.example`)
```
PROVIDER_OAUTH_AUTHORIZE_URL=...      # provider authorize endpoint
PROVIDER_OAUTH_TOKEN_URL=...          # provider token endpoint
PROVIDER_OAUTH_CLIENT_ID=...
PROVIDER_OAUTH_CLIENT_SECRET=...      # local/server only
PROVIDER_OAUTH_SCOPES=...
PROVIDER_OAUTH_CALLBACK_URL=...       # MUST match the OAuth app's registered redirect URI
PROVIDER_OAUTH_REDIRECT_AFTER=...     # optional: where to send the browser after connect
```

## "Route back" / public access
The proxy listens on `127.0.0.1:8787` and is reached from a public frontend via
the existing tunnel-forwarded path (CORS already allows `bypass-tunnel-reminder`).
For real OAuth, set `PROVIDER_OAUTH_CALLBACK_URL` to the **public tunnel** URL
(`https://<tunnel>/oauth/callback`) and register that exact URI in the provider's
OAuth app. Loopback callback is for local dev only.

## Verified
- Existing voice lane (`/api/tts/health`) unchanged after the edit.
- `/oauth/status`, `/oauth/start` config gating, `/oauth/callback` provider-error
  and bad-`state` (CSRF) paths all return correct JSON.
- With config present, `/oauth/start` emits a `302` to the authorize URL carrying
  `response_type=code`, `client_id`, encoded `redirect_uri`, `scope`, and a random
  `state` (proven on a throwaway instance, port 8799).

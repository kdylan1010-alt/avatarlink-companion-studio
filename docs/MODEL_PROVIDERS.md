# Model Providers

AvatarLink uses a **safe BYOK provider abstraction**. It does **not** use ChatGPT web-session cookies, browser scraping, or unofficial session tokens.

## Core rule
- **ChatGPT Free/Plus/Pro login is not the same as OpenAI API access.**
- Use an **official API key/provider key only**.
- Do not store session cookies or personal auth tokens in the frontend.

## Provider priority for near-free testing

### 1) OpenRouter (OpenAI-compatible, supports `:free` models)
- Base URL: `https://openrouter.ai/api/v1`
- Safe path: BYOK OpenRouter API key
- MVP status: **ready to test safely in the current UI**
- Notes:
  - Keep the existing OpenAI-compatible `/chat/completions` path.
  - Choose a current `:free` model from the OpenRouter catalog when available.
  - Good first choice for low-cost browser demos.

### 2) GitHub Models via local safe proxy
- Browser base URL: `http://127.0.0.1:8787/api/github-models`
- Server upstream: `https://models.github.ai/inference`
- Safe path: GitHub Models through the local/server proxy using either `GITHUB_TOKEN` in `.env.local` or the server-side OAuth connector in `scripts/gemini-proxy.mjs`
- MVP status: **recommended real demo path on this Mac**
- Notes:
  - The browser only talks to the safe proxy; `GITHUB_TOKEN`, OAuth client secret, and OAuth access token stay server-side.
  - `GET /api/github-models/health` reports `oauth: { configured, connected, scope, expiresInSec }` without exposing the token.
  - This is the lane the packaged app reuses by default when the local proxy on `:8787` is already running.

### 3) DeepSeek via local safe proxy
- Browser base URL: `http://127.0.0.1:8787/api/deepseek`
- Server upstream: `https://api.deepseek.com/v1/chat/completions`
- Safe path: BYOK `DEEPSEEK_API_KEY` stored only in `.env.local` and used server-side by `scripts/gemini-proxy.mjs`
- MVP status: **wired through the shared safe proxy and packaged UI**
- Notes:
  - The browser never receives the raw DeepSeek key.
  - This lane shares the same strict motion+voice JSON contract as GPT/Qwen/Claude/Gemini/GitHub Models.

### 4) Gemini API key via local/server proxy
- Browser base URL: `http://127.0.0.1:8787/api/gemini`
- Server upstream: `https://generativelanguage.googleapis.com/v1beta`
- Safe path: BYOK Gemini API key from Google AI Studio stored only in `.env.local` as `GEMINI_API_KEY`
- MVP status: **wired through `scripts/gemini-proxy.mjs`**
- Notes:
  - The browser calls the local/server proxy, not Google directly with a raw key.
  - The current saved key is recognized by `models.list`, but `generateContent` is blocked by Google project/quota errors, so the UI keeps the full avatar chain moving with fallback text.
  - A fresh Google project/key with Generate Content quota/billing or support access should work without changing the AvatarLink UI.

### 5) OpenRouter (OpenAI-compatible, supports `:free` models)
- Base URL: `https://openrouter.ai/api/v1`
- Safe path: BYOK OpenRouter API key entered by the operator
- MVP status: **ready to test safely in the current UI and packaged app**
- Notes:
  - OpenRouter is direct browser BYOK here, not proxied through `:8787`.
  - Choose a current `:free` model when available for low-cost demos.

### 6) Local Ollama (dev/local)
- Base URL: `http://localhost:11434/v1`
- Safe path: local-only connector for development
- MVP status: **ready to test safely if Ollama is running locally**
- Notes:
  - No cloud secret is required.
  - Useful for local debugging and no-cost dev loops.

### 7) Local router / OpenAI-compatible gateway
- Base URL: `http://127.0.0.1:8788/v1`
- Safe path: operator-managed local gateway; optional `VITE_LOCAL_ROUTER_API_KEY` only if that router requires auth
- MVP status: **wired in the packaged UI as a configurable advanced path**
- Notes:
  - Useful for LiteLLM, custom routers, or local OpenAI-compatible gateways.
  - This route is intentionally operator-configurable rather than hard-wired to the `:8787` safe proxy.

### 8) Official OpenAI API key / project
- Base URL: `https://api.openai.com/v1`
- Safe path: official OpenAI API key/project only
- MVP status: **ready to test safely in the current UI**
- Notes:
  - This is not the same as a ChatGPT consumer login.
  - Do not use ChatGPT web-session cookies.

## OAuth-ready provider connector scaffold
- Status: **placeholder only**
- Purpose: reserve a safe place for a future official provider OAuth flow
- Current behavior:
  - mocked in the UI
  - no cookies stored
  - no browser session scraping
  - no secrets persisted in frontend code
- Requirement before enabling real OAuth:
  - official provider OAuth docs
  - callback URL confirmed
  - env vars wired on a server-side or secure runtime path

## Packaged-app key setup
The DMG bundles `.env.example` plus docs only — **never `.env.local`**.

On a new Mac, after dragging the app into `/Applications`:
1. Copy `.env.example` from `AvatarLink Companion Studio.app/Contents/Resources/app/` to:
   - `~/Library/Application Support/AvatarLink Companion Studio/.env.local`
2. Fill only the keys/routes you actually want to use:
   - `GITHUB_TOKEN` for GitHub Models, or `PROVIDER_OAUTH_*` for server-side OAuth
   - `DEEPSEEK_API_KEY` for DeepSeek safe-proxy use
   - `GEMINI_API_KEY` for Gemini safe-proxy use
   - optional direct BYOK / router values such as `VITE_OPENROUTER_API_KEY`, `VITE_LOCAL_ROUTER_API_BASE`, `VITE_LOCAL_ROUTER_API_KEY`, `VITE_OLLAMA_API_BASE`, `VITE_OPENAI_API_KEY`
3. Relaunch the app so the launcher/proxy picks up the local env file.

## Env placeholders
See `.env.example` for placeholder values only:
- `VITE_OPENROUTER_API_BASE`
- `VITE_DEEPSEEK_PROXY_BASE`
- `VITE_GEMINI_PROXY_BASE`
- `VITE_OLLAMA_API_BASE`
- `VITE_LOCAL_ROUTER_API_BASE`
- `VITE_OPENAI_API_BASE`
- `VITE_PROVIDER_OAUTH_CALLBACK_URL`
- `VITE_PROVIDER_OAUTH_CLIENT_ID`
- `VITE_PROVIDER_OAUTH_SCOPES`

## Safety notes for Eihei
- Safe test-ready now:
  - **OpenRouter BYOK**
  - **Local Ollama**
  - **Official OpenAI API key**
- Wired but externally blocked in this session:
  - **Gemini generateContent** — key recognized by `models.list`; generation returns Google-side `PROJECT_DENIED_ACCESS` / `QUOTA_EXCEEDED`
  - **OAuth-ready provider connector**

- Place the real Gemini key only in a local ignored env file such as `.env.local` using `GEMINI_API_KEY`. Never commit the real key or expose it through `VITE_` frontend env variables.


## Hermes/OpenAI-Codex local fallback

When Gemini generation is blocked by Google project/quota restrictions, `scripts/gemini-proxy.mjs` can call local Hermes via `hermes -z` as a real alternate LLM provider. This is a local development proof path, not a public SaaS secret strategy. For public deployment, replace it with an official hosted provider API or backend OAuth/API-key flow.

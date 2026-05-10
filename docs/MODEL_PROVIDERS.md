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

### 2) Gemini API key (free-tier friendly scaffold)
- Base URL: `https://generativelanguage.googleapis.com/v1beta`
- Safe path: BYOK Gemini API key from Google AI Studio
- MVP status: **scaffolded in the provider selector**
- Notes:
  - Uses the same OpenAI-style chat surface in this MVP.
  - Keep test claims honest until a real authenticated success response is captured.

### 3) Local Ollama (dev/local)
- Base URL: `http://localhost:11434/v1`
- Safe path: local-only connector for development
- MVP status: **ready to test safely if Ollama is running locally**
- Notes:
  - No cloud secret is required.
  - Useful for local debugging and no-cost dev loops.

### 4) Official OpenAI API key / project
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

## Env placeholders
See `.env.example` for placeholder values only:
- `VITE_OPENROUTER_API_BASE`
- `VITE_GEMINI_API_BASE`
- `VITE_OLLAMA_API_BASE`
- `VITE_OPENAI_API_BASE`
- `VITE_PROVIDER_OAUTH_CALLBACK_URL`
- `VITE_PROVIDER_OAUTH_CLIENT_ID`
- `VITE_PROVIDER_OAUTH_SCOPES`

## Safety notes for Eihei
- Safe test-ready now:
  - **OpenRouter BYOK**
  - **Local Ollama**
  - **Official OpenAI API key**
- Scaffold-only / not yet proven live in this session:
  - **Gemini authenticated success**
  - **OAuth-ready provider connector**

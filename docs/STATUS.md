# AvatarLink Status

## Current delivery surface
- Repo: https://github.com/kdylan1010-alt/avatarlink-companion-studio
- Local path: `/Users/a1111/Desktop/avatarlink-companion-studio`
- Live local demo: `http://127.0.0.1:8008/`
- GitHub Pages target: `https://kdylan1010-alt.github.io/avatarlink-companion-studio/`
- Current Pages result: `404 page not found`

## Latest shipped artifact
- Commit: `11be91b`
- Repo URL: `https://github.com/kdylan1010-alt/avatarlink-companion-studio/commit/11be91b`
- Artifact: safe Gemini backend-proxy fallback plus existing `Run full demo` Mock proof path for VRM + chat + voice/audio fallback + mouth/expression movement.

## Latest verified proof
- Build: `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` → exit `0`
- Browser proof: `PATH=/usr/local/bin:$PATH /usr/local/bin/node scripts/browser-proof.mjs` → exit `1`, but with verified safe-proxy success on `POST http://127.0.0.1:8787/api/github-models/generate` → `200` and `Last provider path` = `full-demo:live-githubModels:openai/gpt-4.1-mini`
- Browser proof artifact: `artifacts/avatarlink-browser-proof-e2e.json`
- Browser proof screenshot: `artifacts/avatarlink-browser-proof-e2e.png`
- Browser proof weakness still present: `POST http://127.0.0.1:8787/api/tts/elevenlabs` → `401`, so routing/GPT path is verified while the paid TTS lane is still blocked
- Mac launcher proof: staged app created `artifacts/macos/dmg-stage/AvatarLink Companion Studio.app/Contents/Resources/app/artifacts/mac-app-launch.json` with app URL `http://127.0.0.1:8008/avatarlink-companion-studio/` and proxy port `8787`
- DMG artifact exists locally at `artifacts/macos/avatarlink-companion-studio-mac.dmg`

## Current blocker
- Gemini live generation is externally blocked. Current proxy generate result is HTTP `429` with code `QUOTA_EXCEEDED`, including `You exceeded your current quota, please check your plan and billing details` and free-tier quota-limit lines for `gemini-2.0-flash`.
- No ChatGPT browser/session/cookie scraping is used; Gemini remains backend-env-only through the local proxy.

## Next step already started
- Wrote `docs/LEAD_PERSISTENCE_PLAN.md` with the practical post-localStorage path: local cache → server endpoint → Supabase/Airtable durable inbox → later webhook/CRM fan-out.

## Fallback artifact
- Zip artifact: `/Users/a1111/Desktop/avatarlink-companion-studio/artifacts/avatarlink-companion-studio-full-demo-9c7124a.zip`
- Provider docs: `docs/MODEL_PROVIDERS.md`
- Env placeholders: `.env.example`
- Lead persistence doc: `docs/LEAD_PERSISTENCE_PLAN.md`

## Gemini provider proof update

- Added `scripts/gemini-proxy.mjs` so Gemini calls use a local/server env key instead of exposing the raw API key in the browser.
- `.env.local` holds `GEMINI_API_KEY` and is gitignored. `.env.example` remains placeholders only.
- Safe-env proof remains current: env names present are `VITE_GEMINI_API_BASE`, `VITE_GEMINI_MODEL`, and `GEMINI_API_KEY`, while `VITE_GEMINI_API_KEY` is absent.
- Secret scan remains clean outside the ignored local env file.
- Current Gemini classification: quota-blocked provider lane, not a frontend/CORS/secret issue.
- Current product proof lane: keep Mock full-chain demo as the visible shipped proof until a live approved provider succeeds.

## Working alternate model proof

- Gemini `generateContent` was tested across all listed `v1beta`/`v1` models plus OpenAI-compatible endpoint; none succeeded because the Google project/key returns `PROJECT_DENIED_ACCESS` or free-tier quota limit `0`.
- Added a real alternate model fallback inside `scripts/gemini-proxy.mjs`: when Gemini is blocked, the proxy calls local Hermes/OpenAI-Codex via `hermes -z` and returns that LLM response to AvatarLink.
- This keeps the user-visible chain working now: provider attempt → real alternate LLM response → browser speech/audio fallback → mouth/body movement.

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
- Build: `npm run build` → exit `0`
- QA smoke: `node scripts/qa-smoke.mjs` → exit `0`
- Gemini proxy health: `GET http://127.0.0.1:8787/api/gemini/health` → `200` with `{"ok":true,"hasKey":true,"keyExposed":false}`
- Mock browser proof at `http://127.0.0.1:8008/`: `Run full demo` shows `Full demo complete — VRM + voice + provider/mock + chat + speech + mouth movement chain visible`
- Mock browser proof: `Last provider path` shows `full-demo:mock`
- Mock browser proof: `Loaded asset` shows `sample.vrm` and `VRM loaded`
- Mock browser proof: `Browser speech error: not-allowed — lip-sync demo continued without audio`

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

# AvatarLink Status

## Current delivery surface
- Repo: https://github.com/kdylan1010-alt/avatarlink-companion-studio
- Local path: `/Users/a1111/Desktop/avatarlink-companion-studio`
- Live local demo: `http://127.0.0.1:4173/`
- GitHub Pages target: `https://kdylan1010-alt.github.io/avatarlink-companion-studio/`
- Current Pages result: `404 page not found`

## Latest shipped artifact
- Commit: `9c7124a1387b17846a2b449eb81ec0bfcdfc3ed3`
- Repo URL: `https://github.com/kdylan1010-alt/avatarlink-companion-studio/commit/9c7124a1387b17846a2b449eb81ec0bfcdfc3ed3`
- Artifact: end-to-end full demo pipeline with `Run full demo`, `Mock / test mode`, sample VRM default loader, browser-speech fallback, and mouth/expression motion proof.

## Latest verified proof
- Build: `/usr/local/bin/node /usr/local/lib/node_modules/npm/bin/npm-cli.js run build` → exit `0`
- QA smoke: `/usr/local/bin/node scripts/qa-smoke.mjs` → exit `0`
- Browser proof: `Run full demo` shows `Full demo complete — VRM + voice + provider/mock + chat + speech + mouth movement chain visible`
- Browser proof: `Last provider path` shows `full-demo:mock`
- Browser proof: `Loaded asset` shows `sample.vrm`
- Browser proof: `Browser speech error: not-allowed — lip-sync demo continued without audio`
- Screenshot: `/Users/a1111/.hermes/cache/screenshots/browser_screenshot_22d00a9a828642caaf5eea8c7cafe845.png`

## Current blocker
- No verified live BYOK provider success has been captured yet; the shipped end-to-end proof is currently mock chat plus browser-speech fallback.

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
- Current key check: `models.list` succeeds, proving the key is recognized, but `generateContent` returns Google-side access/quota failures (`PROJECT_DENIED_ACCESS` / `QUOTA_EXCEEDED` depending on model).
- Product fallback: AvatarLink continues the full VRM → chat → voice/audio → mouth/body movement demo with local fallback text when Gemini is externally blocked.

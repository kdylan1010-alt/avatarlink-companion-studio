# Mac DMG packaging notes

## Decision: keep the safe proxy on 8787

We explicitly kept the AvatarLink safe proxy on `127.0.0.1:8787` instead of forcing `8000`.

Why:
- the app already defaults GitHub Models to `http://127.0.0.1:8787/api/github-models`
- the app already defaults TTS to `http://127.0.0.1:8787/api/tts`
- live browser proof on `2026-06-01` hit `POST http://127.0.0.1:8787/api/github-models/generate` and got HTTP `200`
- changing to `8000` would create churn with no verified benefit

Verified evidence from real execution:
- build command: `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build`
- browser proof command: `PATH=/usr/local/bin:$PATH /usr/local/bin/node scripts/browser-proof.mjs`
- proof artifact: `artifacts/avatarlink-browser-proof-e2e.json`
- verified proxy call inside proof artifact: `http://127.0.0.1:8787/api/github-models/generate` with status `200`

## What was actually validated

Validated directly:
- production build still succeeds
- bundled browser proof still reaches the safe proxy on `8787`
- GitHub Models lane returned `200` through the safe proxy
- hands/arms proof completed in the browser proof run
- full demo completed visually in the proof run

Not fully green:
- ElevenLabs TTS returned `401` / quota-auth failure in the same run, so the proof is good for routing and GPT-path verification, not for a fully healthy paid TTS lane
- app packaging was not previously available as a DMG artifact

## Previous packaging weakness fixed in this pass

Before this pass:
- there was no Mac DMG artifact
- there was no app bundle launcher for a local static server plus proxy path
- the local packaging decision around `8787` vs `8000` was not written down clearly

This pass adds:
- a Mac `.app` launcher bundle
- a DMG build script using `hdiutil`
- explicit documentation that `8787` stays the proxy port because it already works

## Packaging shape

The DMG contains:
- `AvatarLink Companion Studio.app`
- a short README
- an `/Applications` shortcut

The launcher app:
- serves the bundled `dist/` output locally
- serves avatar assets from bundled `public/`
- starts or reuses the safe proxy on `127.0.0.1:8787`
- opens the local browser URL automatically

## Secrets policy

Secrets are not bundled into the DMG intentionally.
For this Mac, the launcher can reuse the existing project `.env.local` as a fallback if it exists at:
- `/Users/a1111/Desktop/avatarlink-companion-studio/.env.local`

For another Mac, live provider access requires a local `.env.local` added by the operator at:
- `~/Library/Application Support/AvatarLink Companion Studio/.env.local`

Recommended setup flow on a new Mac:
1. Open `AvatarLink Companion Studio.app/Contents/Resources/app/.env.example`
2. Copy it to `~/Library/Application Support/AvatarLink Companion Studio/.env.local`
3. Add only the providers you want, for example:
   - `GITHUB_TOKEN` or `PROVIDER_OAUTH_*` for GitHub Models
   - `DEEPSEEK_API_KEY` for DeepSeek
   - `GEMINI_API_KEY` for Gemini
   - optional direct BYOK / router values such as `VITE_OPENROUTER_API_KEY`, `VITE_LOCAL_ROUTER_API_BASE`, `VITE_LOCAL_ROUTER_API_KEY`, `VITE_OLLAMA_API_BASE`, `VITE_OPENAI_API_KEY`
4. Relaunch the app so the launcher/proxy picks up the local file.

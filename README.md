# AvatarLink Companion Studio

Browser-native no-code **AI avatar companion engine** MVP for VRM plus common Sketchfab-style GLB/glTF preview lanes.

## Product framing
- Not an unrestricted NSFW AI girlfriend app
- Focused on creator-owned companion avatars, coaching guides, fan-community greeters, lore bots, and character experiences
- Browser-native VRM first, with direct GLB/embedded glTF preview for common Sketchfab exports
- FBX/USDZ are accepted in the picker as conversion-needed lanes; convert/export to GLB for reliable browser preview

## MVP scope
- Guided creator flow: choose/upload avatar → pick provider/voice → type message → run full demo
- Developer Debugging Mode toggle hides raw status/proof/config panels by default
- VRM upload + preview panel, plus direct GLB/embedded glTF preview for Sketchfab-style assets
- Chat UI shell
- Lead capture persisted in browser localStorage + CSV export
- Latest lead handoff preview + follow-up draft CTA
- Lead queue snapshot for operator triage
- Delivery bridge JSON export for handoff outside the browser
- OpenAI-compatible BYOK configuration form (local/browser only)
- TTS adapter stub
- Web Audio amplitude -> mouth movement stub
- Persona editor
- Safety + asset-rights onboarding checklist


## Creator import flow
- Default view is intentionally creator-facing: one guided four-step path and one primary next action.
- Upload accepts `.vrm`, `.glb`, `.gltf`, `.fbx`, and `.usdz`.
- Direct runtime preview is implemented for VRM, GLB, and embedded/single-file glTF.
- FBX/USDZ and multi-file glTF exports should be converted/exported to GLB before upload.
- Detailed format guidance lives in `docs/SKETCHFAB_IMPORT_GUIDE.md`.

## Local run
```bash
cd /Users/a1111/Desktop/avatarlink-companion-studio
/usr/local/bin/npm install
/usr/local/bin/npm run dev
```

## Build
```bash
cd /Users/a1111/Desktop/avatarlink-companion-studio
/usr/local/bin/node ./node_modules/vite/bin/vite.js build
```

## QA smoke
```bash
node scripts/qa-smoke.mjs
```

## No secrets policy
- Do not commit API keys, cookies, tokens, or paid-provider credentials
- BYOK fields are demo-only and intended for local/runtime wiring later

## Default demo avatar
- Ships with `public/avatars/sample.vrm` as the default demo avatar
- Source/license notes live in `docs/DEMO_ASSETS.md`


## Shared delivery fallback
- Repo delivery surface: `https://github.com/kdylan1010-alt/avatarlink-companion-studio`
- Live local demo: `http://127.0.0.1:4173/`
- Status ledger: `docs/STATUS.md`
- Team inbox + blocker routing: `docs/DELIVERY_AND_INBOX.md`

## Safe model provider path
- Safe provider guidance: `docs/MODEL_PROVIDERS.md`
- ChatGPT Free/Plus/Pro login is not the same as OpenAI API access
- Use official API key/provider key only

# AvatarLink Companion Studio

Browser-native no-code **VRM/VTuber AI avatar companion engine** MVP.

## Product framing
- Not an unrestricted NSFW AI girlfriend app
- Focused on creator-owned companion avatars, coaching guides, fan-community greeters, lore bots, and character experiences
- Browser-native VRM first; no Blender dependency in v1

## MVP scope
- VRM upload + preview panel
- Chat UI shell
- OpenAI-compatible BYOK configuration form (local/browser only)
- TTS adapter stub
- Web Audio amplitude -> mouth movement stub
- Persona editor
- Safety + asset-rights onboarding checklist

## Local run
```bash
cd /Users/a1111/Desktop/avatarlink-companion-studio
/usr/local/bin/npm install
/usr/local/bin/npm run dev
```

## Build
```bash
/usr/local/bin/npm run build
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

# QA Plan

## Smoke checks
1. App loads title "AvatarLink Companion Studio"
2. Safety onboarding checklist renders
3. Persona editor fields render
4. VRM upload dropzone renders
5. Chat composer renders
6. BYOK config panel renders without any embedded secrets
7. TTS stub section renders
8. Mouth-movement amplitude stub renders

## Commands
```bash
/usr/local/bin/npm run build
node scripts/qa-smoke.mjs
```

## VRM smoke flow
1. Verify `/avatars/sample.vrm` returns HTTP 200 with nonzero bytes
2. Load `VrmSmokeTest` and confirm browser console logs `VRM loaded`
3. Confirm default sample renders before testing user upload

4. Confirm lead persistence + CSV export controls render and smoke passes
5. Confirm lead handoff preview + follow-up draft CTA render and smoke passes

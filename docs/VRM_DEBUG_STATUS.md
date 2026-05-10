# VRM Debug Status

- three: ^0.177.0
- @pixiv/three-vrm: ^3.4.2
- sample path: `/avatars/sample.vrm`
- sample local path: `public/avatars/sample.vrm`
- current primary sample: `human_male.vrm` from `mrxz/vrm-sample-models`
- fallback sample candidate: `Avatar_Orion.vrm` or `cryptovoxels.vrm` from `madjin/vrm-samples`

## 2026-05-10 14:30 CST — provider response map proof + builder path
- Commit proving the response-map artifact exists: `f955a3ac090567180defb65343958bc35004b8d1` (`feat: add provider response mapping preview`)
- Smoke command: `/usr/local/bin/node scripts/qa-smoke.mjs`
- Smoke result: `PASS provider_response_map` and all listed smoke checks passed.
- Direct builder command used successfully: `/usr/local/bin/node ./node_modules/vite/bin/vite.js build`
- Build artifact proof:
  - `dist/index.html                   0.52 kB`
  - `dist/assets/index-BKOZzRdD.css    2.92 kB`
  - `dist/assets/index-BXaq0YMu.js   877.48 kB`
- Browser-visible proof on `http://127.0.0.1:4173/`:
  - `Provider response mapping preview`
  - `provider: stub`
  - `frameBridgeKey: frames`
  - `transcriptKey: text`
  - `voiceKey: voiceId`
- Remaining blocker is not VRM loading; it is lack of persisted lead capture backend and missing browser-proof for manual user-upload flow.

## 2026-05-10 14:55 CST — upload-path artifact started
- Added a visible `Run simulated upload proof` button in `src/components/VrmStudioPanel.jsx`.
- Purpose: exercise the exact `loadFile(file)` path using a browser-created `File` from `/avatars/sample.vrm`, even when direct browser automation cannot attach a desktop file.
- Expected proof target on success: render status `VRM preview rendered in-browser via simulated upload` and console log `VRM file load succeeded`.


## 2026-05-10 15:18 CST — money-build lead persistence artifact
- Added `Export leads CSV` button and browser `localStorage` persistence in `src/components/LeadCapturePanel.jsx`.
- New smoke proof target: `PASS lead_persistence`.
- Revenue artifact is now more concrete than React-only state: saved leads survive reload in-browser and can be exported as `avatarlink-pilot-leads.csv`.

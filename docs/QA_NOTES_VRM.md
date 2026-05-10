# VRM QA Notes

## Sample chosen
- Primary sample: `human_male.vrm` from `mrxz/vrm-sample-models`
- License: CC0 via `human_male/LICENSE` → `https://creativecommons.org/publicdomain/zero/1.0`
- Local path: `public/avatars/sample.vrm`
- Served path: `/avatars/sample.vrm`

## Debug results
1. Asset serving check
   - Fetch to `/avatars/sample.vrm` returned HTTP 200
   - Response size: 58,400 bytes
   - Content-Type: `application/octet-stream`
2. Loader isolation check
   - `VrmSmokeTest` loaded the sample and logged `VRM loaded`
   - Browser-visible details:
     - avatarName: `Human Male`
     - specVersion: `1`
     - sceneChildren: `4`
     - humanoidBoneCount: `19`
     - expressionCount: `0`
3. Main preview wiring check
   - `VrmStudioPanel` auto-loads `/avatars/sample.vrm` on boot
   - Browser console logged `Default sample VRM loaded`
4. Console proof
   - Browser console errors: none
   - First console logs:
     - `VRM loaded ...`
     - `Default sample VRM loaded ...`

## Version check
- `three`: `^0.177.0`
- `@pixiv/three-vrm`: `^3.4.2`
- Current sample compatibility: working with this import path and package pair

## Fallback plan
- If a future sample fails, try `Avatar_Orion.vrm` or `cryptovoxels.vrm` from `madjin/vrm-samples` and record the exact compatibility issue.

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


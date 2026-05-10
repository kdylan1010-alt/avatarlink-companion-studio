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

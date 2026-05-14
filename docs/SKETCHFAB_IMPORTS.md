# AvatarLink Sketchfab import status

AvatarLink now accepts the common Sketchfab export names in the upload picker: `.vrm`, `.glb`, `.gltf`, `.fbx`, and `.usdz`.

## Direct browser preview

- `.vrm`: loaded with `GLTFLoader` plus `VRMLoaderPlugin`, preserving VRM expressions, humanoid bones, mouth movement, and arm proof where the rig exposes normalized humanoid bones.
- `.glb` / `.gltf`: loaded directly with Three.js `GLTFLoader` and framed in the preview canvas. These assets preview visually even when they are not VRM avatars. Non-VRM glTF/GLB files may not expose VRM expressions or humanoid bones, so lip-sync and hand/arm proof are limited unless the asset is converted/retargeted to VRM.

## Conversion-required formats

- `.fbx`: common as a Sketchfab original download, but direct browser support adds loader and material/animation edge cases. Export/convert to `.glb` or `.gltf` first for reliable web preview.
- `.usdz`: useful for Apple AR workflows, but not the primary Three.js/avatar runtime path. Convert to `.glb` before upload.

Recommended production path for Sketchfab assets: download a legal/allowed `.glb` or `.gltf` when available; otherwise convert the original `.fbx`/`.usdz` to GLB offline, then test the GLB in AvatarLink. Keep source URL, license, and conversion notes with each imported asset.

# Sketchfab import guide

AvatarLink now treats common Sketchfab downloads as a creator import lane instead of requiring every avatar to be VRM.

## Best path: GLB

Use the bundled `.glb` download when Sketchfab provides it. GLB is a single-file glTF package, so the browser preview can load it directly with Three.js `GLTFLoader` without extra conversion files.

## Supported preview formats

- `.vrm` — full avatar companion path using the VRM loader/plugin, including humanoid and expression metadata when present.
- `.glb` — direct browser preview using `GLTFLoader`; best Sketchfab path for non-VRM assets.
- `.gltf` — direct preview for embedded/single-file glTF. If the export references separate `.bin` or texture files, export/convert to GLB first so the browser receives one complete asset.

## Conversion-needed formats

- `.fbx` — common Sketchfab original format, but direct browser support is heavier and less reliable for this app. Convert/export FBX to GLB before upload.
- `.usdz` — useful for Apple/AR workflows, but not the primary web-preview format here. Convert/export USDZ to GLB before upload.

## Creator-facing workflow

1. Download GLB from Sketchfab when available.
2. If only FBX/USDZ is available, convert/export it to GLB with a trusted DCC/converter before upload.
3. Upload `.vrm`, `.glb`, or embedded `.gltf` in AvatarLink Step 1.
4. Use Developer Debugging Mode only if you need loader details, proof artifacts, or raw status.

## Safety/licensing

Only upload assets that are owned, licensed, or explicitly allowed for the intended use. Keep the source URL, author, and license with any proof artifact.

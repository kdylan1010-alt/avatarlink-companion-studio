# AvatarLink UI redesign research notes

User problem: the previous interface exposed too many raw panels and did not make the next click obvious. The redesign follows research-backed patterns from established UX systems.

## Sources consulted

- Nielsen Norman Group: progressive disclosure, visibility of system status, recognition rather than recall, cognitive load.
- Material Design 3: cards, color roles, navigation hierarchy, progress/state communication.
- Apple Human Interface Guidelines: progressive disclosure and settings hierarchy.
- Microsoft Fluent 2: command hierarchy, settings surfaces, disclosure.
- GOV.UK Design System: task-based services, clear labels/hint text.
- Atlassian/Carbon/Shopify Polaris/Adobe Spectrum: page layout, forms, empty states, choice cards, creator-preview patterns.
- Google People + AI Guidebook: AI UX should keep user control, defaults, explain status without exposing implementation internals.

## Design decisions implemented

1. **One obvious path:** Avatar → Voice → Message → Run demo. The page now opens with a guided stepper and a large fast-path demo button.
2. **Progressive disclosure:** raw JSON, API URLs, smoke tests, proof controls, persona editor, and lead tools are hidden unless Developer Debugging Mode is enabled.
3. **Persistent preview summary:** a sticky right rail summarizes avatar, voice, AI route, message readiness, and has one primary `Run avatar demo` action.
4. **Plain-language copy:** creator-facing terms replace internal labels in default mode.
5. **Sensible defaults:** sample avatar, recommended safe GPT-4 mini/GitHub Models proxy, fallback voice path, and starter prompt remain preselected so the demo can run immediately.
6. **Format guidance:** the upload surface now explains the real Sketchfab lane: GLB/glTF are the browser-friendly route; FBX/USDZ require conversion/export to GLB first.
7. **Modern visual hierarchy:** stronger hero, clearer cards, better spacing, sticky preview, hover states, and a restrained dark gradient theme.

## Next UI improvements

- Replace dropdowns with full visual choice cards for avatar and voice presets.
- Add real thumbnails for bundled sample avatars.
- Add an import helper for multi-file glTF folders and optional server-side FBX/USDZ conversion.
- Add a short first-run walkthrough overlay if users still hesitate.

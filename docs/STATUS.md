# AvatarLink Status

## Current delivery surface
- Repo: https://github.com/kdylan1010-alt/avatarlink-companion-studio
- Local path: `/Users/a1111/Desktop/avatarlink-companion-studio`
- Live local demo: `http://127.0.0.1:4173/`
- GitHub Pages target: `https://kdylan1010-alt.github.io/avatarlink-companion-studio/`
- Current Pages result: `404 page not found`

## Latest shipped artifact
- Commit before this status update: `46fc5c4823abac0cbd8ebade1c0b89eeea1c1535`
- Artifact: revenue/ops waitlist flow with `Export leads CSV`, `Export delivery JSON`, `LATEST LEAD HANDOFF`, `LEAD QUEUE SNAPSHOT`, and `DELIVERY BRIDGE PAYLOAD`

## Latest verified proof
- Live page title: `AvatarLink Companion Studio`
- Delivery proof on page: `queueSize: 2` with hot + warm lead records in the bridge payload
- Remote/shared delivery target present: `false`

## Run + build commands
```bash
cd /Users/a1111/Desktop/avatarlink-companion-studio
/usr/local/bin/node scripts/qa-smoke.mjs
/usr/local/bin/node ./node_modules/vite/bin/vite.js build
python3 -m http.server 4173 -d dist
```

## Current blocker
- The money-build artifact supports browser persistence and CSV/JSON export, but does not yet expose a remote/shared delivery target or webhook/CRM send path.

## Next artifact target
- Add a visible remote-delivery fallback surface in the app and keep GitHub repo/docs/issues as the shared delivery/inbox path until a real CRM/webhook exists.

## Fallback artifact
- Repo artifact path: `artifacts/avatarlink-companion-studio-fallback-a9df7c7.zip`
- Local artifact path: `/Users/a1111/Desktop/avatarlink-companion-studio/artifacts/avatarlink-companion-studio-fallback-a9df7c7.zip`
- Build command: `/usr/local/bin/node ./node_modules/vite/bin/vite.js build`
- Build exit code: `0`


## End-to-end demo fallback
- Basic flow now runs in-browser with `Run companion reply`.
- If no API key is entered, the app uses demo-local browser speech fallback and animates the avatar mouth while speaking.
- Remaining real-runtime blocker: no verified live provider credential/test response has been supplied yet, so live OpenAI-compatible success is not proven complete.

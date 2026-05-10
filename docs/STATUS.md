# AvatarLink Status

## Current delivery surface
- Repo: https://github.com/kdylan1010-alt/avatarlink-companion-studio
- Local path: `/Users/a1111/Desktop/avatarlink-companion-studio`
- Live local demo: `http://127.0.0.1:4173/`
- GitHub Pages target: `https://kdylan1010-alt.github.io/avatarlink-companion-studio/`
- Current Pages result: `404 page not found`

## Latest shipped artifact
- Commit before this status update: `7fef9b64144c8dfa499d359edac0b0c6b4965e64`
- Artifact: end-to-end companion demo flow with configurable OpenAI-compatible base URL / API key / model, `Run companion reply`, browser speech fallback, and avatar lip-sync playback alongside the existing revenue/ops waitlist panels.

## Latest verified proof
- Live page title: `AvatarLink Companion Studio`
- Delivery proof on page: `queueSize: 2` with hot + warm lead records in the bridge payload
- Companion flow proof on page: `Run companion reply`, `Voice provider`, `Voice ID / browser voice`, `Companion runtime status`, and `Last assistant response`
- Debug proof on 2026-05-10: stubbed live provider branch hit `POST /chat/completions`, sent auth header + model + messages, returned `Stubbed live provider reply for wiring proof.`, updated status to `Live provider response received`, and spoke the reply via browser speech.

## Run + build commands
```bash
cd /Users/a1111/Desktop/avatarlink-companion-studio
/usr/local/bin/node scripts/qa-smoke.mjs
/usr/local/bin/node ./node_modules/vite/bin/vite.js build
python3 -m http.server 4173 -d dist
```

## Current blocker
- Shared delivery fallback is no longer the blocker.
- The remaining blocker is a missing verified successful call against a real OpenAI-compatible provider with valid credentials; live authenticated provider success is not yet proven.

## Next artifact target
- Capture a real authenticated provider proof run using user-supplied valid endpoint/key/model, then record the exact response path and any provider-specific error if it fails.

## Fallback artifact
- Repo artifact path: `artifacts/avatarlink-companion-studio-fallback-a9df7c7.zip`
- Local artifact path: `/Users/a1111/Desktop/avatarlink-companion-studio/artifacts/avatarlink-companion-studio-fallback-a9df7c7.zip`
- Build artifact path: `dist/assets/index-bdP3VZfE.js`
- Build command: `/usr/local/bin/node ./node_modules/vite/bin/vite.js build`
- Build exit code: `0`

## End-to-end demo fallback
- Basic flow now runs in-browser with `Run companion reply`.
- If no API key is entered, the app uses demo-local browser speech fallback and animates the avatar mouth while speaking.
- Remaining real-runtime blocker: no verified live provider credential/test response has been supplied yet, so live OpenAI-compatible success is not proven complete.

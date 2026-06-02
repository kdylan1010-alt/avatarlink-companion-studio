# Operations Runbook

Everything needed to run, change, and keep the AvatarLink backend stable.
Project root: `/Users/a1111/Desktop/avatarlink-companion-studio`.

## Components
| Component | What | Port | Managed by |
|---|---|---|---|
| Safe proxy | LLM motion lanes + TTS voice + OAuth (`scripts/gemini-proxy.mjs`) | `8787` | **launchd agent** `ai.avatarlink.proxy` |
| Static app | Built UI served to the browser | `8008` | app launcher / static server |
| Packaged app | `AvatarLink Companion Studio.app` | — | reuses the `:8787` proxy if already up |

The proxy is the always-on service. The app launcher checks `/api/github-models/health`
and **reuses** a running proxy instead of starting another, so keeping the agent up
is safe and conflict-free.

## Run / stop / restart (proxy)
```bash
cd ~/Desktop/avatarlink-companion-studio
./scripts/proxy-control.sh status     # is it up? show launchd state
./scripts/proxy-control.sh start      # load agent + start
./scripts/proxy-control.sh restart    # kickstart -k
./scripts/proxy-control.sh stop       # unload agent
./scripts/proxy-control.sh logs 60    # last 60 log lines
```
The launchd agent (`~/Library/LaunchAgents/ai.avatarlink.proxy.plist`) auto-restarts
the proxy on crash and starts it at login/boot. Logs: `logs/proxy.out.log`,
`logs/proxy.err.log`.

## Run the UI (dev)
```bash
/usr/local/bin/npm install
/usr/local/bin/npm run dev      # vite dev server
# or build + serve the static app
/usr/local/bin/node ./node_modules/vite/bin/vite.js build
```

## Change things

### Add / change a provider API key (BYOK)
Secrets live in `.env.local` only (gitignored). Then `./scripts/proxy-control.sh restart`.
```
OPENAI_API_KEY=...        # GPT lane (also the OpenAI TTS lane)
DEEPSEEK_API_KEY=...      # DeepSeek lane
QWEN_API_KEY=...          # Qwen lane (or DASHSCOPE_API_KEY)
ANTHROPIC_API_KEY=...     # Claude lane
GEMINI_API_KEY=...        # Gemini lane
GITHUB_TOKEN=...          # GitHub Models lane (or use OAuth)
ELEVENLABS_API_KEY=...    # voice
```

### Change a default model
Edit the `*_MODEL` vars in `.env.example` (non-secret defaults) or set them in
`.env.local` to override, then restart. Per-request override: POST `{"model":"..."}`.

### Add a new LLM lane
In `scripts/gemini-proxy.mjs`: for an OpenAI-compatible provider add one wrapper
over `callOpenAICompatible(...)` and one row in the `LLM_LANES` table — that
auto-creates `/api/<lane>/health` and `POST /api/<lane>/generate`. See
`docs/LLM_LANES.md`.

### Connect a provider via OAuth
Fill `PROVIDER_OAUTH_*` in `.env.local`, restart, open `/oauth/start`.
See `docs/OAUTH_ROUTE.md`.

## Health checks
```bash
B=http://127.0.0.1:8787
curl -s $B/api/tts/health                 # voice providers
for l in gpt qwen deepseek claude gemini github-models; do curl -s $B/api/$l/health; echo; done
curl -s $B/oauth/status
```

## Rollback
Timestamped backups of every edited file live in `backups/`
(`gemini-proxy.mjs.bak-<ts>`, `.env.example.bak-<ts>`, `package.json.bak-<ts>`).
Restore one, then `./scripts/proxy-control.sh restart`.

## Known fix baked in
Node 20 couldn't build the TLS chain to `models.github.ai`
(`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`). The agent and the `*:proxy` npm scripts set
`NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem` (system CA bundle). Keep this on any new
launch method.

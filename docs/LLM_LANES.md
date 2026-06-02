# LLM Provider Lanes (motion + voice)

Each lane is an LLM provider that returns the avatar's spoken reply **plus**
`movement_cues` (motion), via one shared strict-JSON contract. TTS then voices
the reply. Implemented in `scripts/gemini-proxy.mjs` (safe proxy, `127.0.0.1:8787`).

## Lanes
| Lane | Route | Transport | Key (`.env.local`) | Default model |
|---|---|---|---|---|
| GPT | `/api/gpt/generate` | OpenAI chat/completions | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Qwen | `/api/qwen/generate` | OpenAI-compatible (DashScope) | `QWEN_API_KEY` / `DASHSCOPE_API_KEY` | `qwen-plus` |
| DeepSeek | `/api/deepseek/generate` | OpenAI-compatible | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| Claude | `/api/claude/generate` | Anthropic Messages API | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| Gemini | `/api/gemini/generate` | Google generateContent | `GEMINI_API_KEY` | `gemini-2.0-flash` |
| GitHub Models | `/api/github-models/generate` | GitHub Models (OAuth or `GITHUB_TOKEN`) | OAuth / `GITHUB_TOKEN` | `openai/gpt-4.1-mini` |

Each lane also has `GET /api/<lane>/health` → `{ hasKey, model }`. `POST` body:
`{ "userPrompt": "...", "systemPrompt"?: "...", "model"?: "..." }`.

Response (all lanes, uniform):
`{ ok, text, reply, emotion, movement_cues:[{time,part,action,intensity,duration}], speech_cues, motionPlan, model }`.

## Shared internals (no duplication)
- `avatarMotionSystemPrompt(systemPrompt)` — the one strict-JSON instruction every lane sends.
- `buildAvatarResult(rawText, userPrompt, model, emptyLabel)` — parses provider text via `parseAvatarMotionPlanResponse` into the uniform shape.
- `callOpenAICompatible(...)` — shared GPT/Qwen/DeepSeek caller; `callClaude` for Anthropic's shape.
- `runGenerateLane(...)` — primary provider → Hermes local fallback → structured error.
- `LLM_LANES` table registers health + generate routes for gpt/qwen/deepseek/claude.

## Config
Non-secret bases + model defaults live in `.env.example`
(`OPENAI_API_BASE`, `OPENAI_CHAT_MODEL`, `DEEPSEEK_API_BASE/MODEL`,
`QWEN_API_BASE/MODEL`, `ANTHROPIC_API_BASE/MODEL`). Real `*_API_KEY` secrets go in
`.env.local` only. A lane with no key returns its `MISSING_*_API_KEY` code and
falls back to the local Hermes responder.

## TLS note (important)
Node 20's bundled CA store could not build the chain to `models.github.ai`
(`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`) even though the cert is a valid
Sectigo→USERTrust chain. Fix: the `*:proxy` npm scripts now launch with
`NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/etc/ssl/cert.pem}`, pointing Node at
the system CA bundle. This *adds* trusted roots — TLS verification stays on.

## Verified 2026-06-02
- All six `/api/<lane>/health` return 200.
- Live `POST /api/github-models/generate` → `ok:true`, reply + 7 movement cues
  (first cue: `rightHand wave`), after the TLS fix.
- New lanes report `hasKey:false` until keys are added to `.env.local`.

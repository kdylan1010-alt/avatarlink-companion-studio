import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const PORT = Number(process.env.AVATARLINK_PROXY_PORT || process.env.GEMINI_PROXY_PORT || 8787)
const PROJECT_ROOT = process.cwd()
const execFileAsync = promisify(execFile)
const HERMES_BIN = process.env.HERMES_BIN || '/Users/a1111/.local/bin/hermes'
const ARTIFACTS_DIR = path.join(PROJECT_ROOT, 'artifacts', 'tts')

function loadLocalEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    if (!process.env[key]) process.env[key] = rest.join('=').trim()
  }
}

loadLocalEnv()

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, bypass-tunnel-reminder',
  })
  res.end(JSON.stringify(payload))
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function callHermesFallback({ systemPrompt, userPrompt }) {
  const prompt = `${systemPrompt || 'You are an AvatarLink companion.'}\n\nUser: ${userPrompt || 'Hello'}\n\nReply as the avatar companion in 1-2 short sentences.`
  try {
    const { stdout } = await execFileAsync(HERMES_BIN, ['-z', prompt], {
      timeout: 90000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: `/Users/a1111/.local/bin:${process.env.PATH || ''}` },
    })
    const text = stdout.trim()
    if (text) return { ok: true, text, model: 'hermes-openai-codex-fallback' }
    return { ok: false, message: 'Hermes fallback returned empty output' }
  } catch (error) {
    return { ok: false, message: error.message || 'Hermes fallback failed' }
  }
}

function fallbackReply(userPrompt) {
  return `AvatarLink local fallback: Thanks — I can continue the avatar motion path for “${userPrompt || 'your message'},” but the live provider is currently blocked or unavailable.`
}

function redactSecretText(value) {
  return String(value || '')
    .replace(/gh[pousr]_[0-9A-Za-z_]+/g, '[REDACTED]')
    .replace(/github_pat_[0-9A-Za-z_]+/g, '[REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]')
}

function classifyGeminiError(status, bodyText) {
  try {
    const parsed = JSON.parse(bodyText)
    const err = parsed.error || {}
    const message = redactSecretText(err.message || bodyText)
    if (status === 403 && /denied access/i.test(message)) {
      return { code: 'PROJECT_DENIED_ACCESS', message }
    }
    if (status === 403) return { code: 'PERMISSION_DENIED', message }
    if (status === 429) return { code: 'QUOTA_EXCEEDED', message }
    if (status === 404) return { code: 'MODEL_NOT_AVAILABLE', message }
    return { code: err.status || `HTTP_${status}`, message }
  } catch {
    return { code: `HTTP_${status}`, message: bodyText.slice(0, 500) }
  }
}



function buildFallbackMotionPlan(text) {
  const spokenText = String(text || '').trim() || 'Hello.'
  const segments = spokenText
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 4)
  const sourceSegments = segments.length ? segments : [spokenText]
  let startMs = 0
  const cues = sourceSegments.map((segment, index) => {
    const wordCount = segment.split(/\s+/).filter(Boolean).length || 1
    const durationMs = Math.max(650, Math.min(1800, 420 + wordCount * 110))
    const cue = {
      startMs,
      durationMs,
      text: segment,
      mood: index === sourceSegments.length - 1 ? 'speaking' : 'listening',
      body: {
        body: Number((0.82 + index * 0.06).toFixed(2)),
        head: Number((1.05 + (index % 2) * 0.1).toFixed(2)),
        arms: Number((0.72 + index * 0.08).toFixed(2)),
        hands: Number((0.92 + index * 0.12).toFixed(2)),
        hair: 1.2,
        eyes: 1.0,
      },
    }
    startMs += durationMs
    return cue
  })
  return {
    format: 'avatar_motion_plan_v1',
    spokenText,
    cues,
  }
}

function parseAvatarMotionPlanResponse(text) {
  const raw = String(text || '').trim()
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(stripped)
    if (parsed && typeof parsed === 'object' && typeof parsed.spokenText === 'string') {
      const fallbackPlan = buildFallbackMotionPlan(parsed.spokenText)
      const cues = Array.isArray(parsed.cues) && parsed.cues.length ? parsed.cues.slice(0, 24) : fallbackPlan.cues
      return {
        text: parsed.spokenText.trim(),
        motionPlan: {
          format: 'avatar_motion_plan_v1',
          spokenText: parsed.spokenText.trim(),
          cues,
        },
      }
    }
  } catch {}
  const fallbackPlan = buildFallbackMotionPlan(raw)
  return { text: fallbackPlan.spokenText, motionPlan: fallbackPlan }
}

function classifyGithubModelsError(status, bodyText) {
  try {
    const parsed = JSON.parse(bodyText)
    const message = redactSecretText(parsed?.error?.message || parsed?.message || bodyText)
    if (status === 401) return { code: 'GITHUB_MODELS_UNAUTHORIZED', message }
    if (status === 403) return { code: 'GITHUB_MODELS_FORBIDDEN', message }
    if (status === 404) return { code: 'GITHUB_MODELS_MODEL_NOT_FOUND', message }
    if (status === 429) return { code: 'GITHUB_MODELS_RATE_LIMITED', message }
    return { code: `GITHUB_MODELS_HTTP_${status}`, message }
  } catch {
    return { code: `GITHUB_MODELS_HTTP_${status}`, message: redactSecretText(bodyText).slice(0, 500) }
  }
}

async function callGithubModels({ model, systemPrompt, userPrompt }) {
  const key = process.env.GITHUB_TOKEN
  if (!key) {
    return { ok: false, status: 500, code: 'MISSING_GITHUB_TOKEN', message: 'GITHUB_TOKEN is missing from .env.local' }
  }
  const selectedModel = model || process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4.1-mini'
  const response = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: 'system', content: `${systemPrompt || 'You are an AvatarLink companion.'}
You control an upper-body avatar. Return STRICT JSON only, no markdown. Schema: {"spokenText":"1-2 short sentences the avatar will say aloud","cues":[{"startMs":0,"durationMs":700,"text":"spoken words covered by this cue","mood":"speaking","body":{"body":1.0,"head":1.0,"arms":1.0,"hands":1.0,"hair":1.3,"eyes":1.0}}]}. Values 0-2.5. Cues must describe how every part moves while that exact text is being spoken.` },
        { role: 'user', content: userPrompt || 'Hello' },
      ],
      temperature: 0.45,
      max_tokens: 520,
    }),
  })
  const bodyText = await response.text()
  if (!response.ok) {
    return { ok: false, status: response.status, ...classifyGithubModelsError(response.status, bodyText) }
  }
  const parsed = JSON.parse(bodyText)
  const rawText = parsed?.choices?.[0]?.message?.content?.trim()
  const motionParsed = parseAvatarMotionPlanResponse(rawText || '')
  return { ok: true, text: motionParsed.text || 'GitHub Models returned an empty response.', motionPlan: motionParsed.motionPlan, model: selectedModel }
}


function ensureArtifactsDir() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
}

function safeSlug(value, fallback = 'sample') {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback
}

function writeAudioArtifact({ provider, ext, bytes }) {
  ensureArtifactsDir()
  const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeSlug(provider)}.${ext}`
  const filePath = path.join(ARTIFACTS_DIR, filename)
  fs.writeFileSync(filePath, Buffer.from(bytes))
  return filePath
}

function maybeReadWavDurationMs(buffer) {
  try {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null
    let offset = 12
    let sampleRate = null
    let byteRate = null
    let dataSize = null
    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4)
      const chunkSize = buffer.readUInt32LE(offset + 4)
      const chunkStart = offset + 8
      if (chunkId === 'fmt ') {
        sampleRate = buffer.readUInt32LE(chunkStart + 4)
        byteRate = buffer.readUInt32LE(chunkStart + 8)
      }
      if (chunkId === 'data') dataSize = chunkSize
      offset = chunkStart + chunkSize + (chunkSize % 2)
    }
    if (byteRate && dataSize) return Math.round((dataSize / byteRate) * 1000)
    if (sampleRate && dataSize) return Math.round((dataSize / sampleRate) * 1000)
    return null
  } catch {
    return null
  }
}

async function createTtsResult({ provider, response, ext, voiceId, voiceName, endpoint, modelId, format }) {
  const arrayBuffer = await response.arrayBuffer()
  const bytes = Buffer.from(arrayBuffer)
  const audioPath = writeAudioArtifact({ provider, ext, bytes })
  const durationMs = ext === 'wav' ? maybeReadWavDurationMs(bytes) : null
  return {
    ok: true,
    provider,
    voiceId,
    voiceName,
    modelId,
    endpoint,
    httpStatus: response.status,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    audioPath,
    audioBase64: bytes.toString('base64'),
    bytes: bytes.length,
    durationMs,
    format,
  }
}

async function callElevenLabsTts({ text, voiceId, voiceName, modelId, outputFormat }) {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    return { ok: false, provider: 'elevenlabs', code: 'MISSING_ELEVENLABS_API_KEY', message: 'ELEVENLABS_API_KEY is missing from .env.local', endpoint: '/api/tts/elevenlabs', voiceId: voiceId || process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb', voiceName: voiceName || process.env.ELEVENLABS_VOICE_NAME || 'configure-in-dashboard' }
  }
  const selectedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'
  const selectedVoiceName = voiceName || process.env.ELEVENLABS_VOICE_NAME || 'configure-in-dashboard'
  const selectedModelId = modelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
  const selectedOutputFormat = outputFormat || process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128'
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream?output_format=${encodeURIComponent(selectedOutputFormat)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text || 'AvatarLink voice quality proof sample.',
      model_id: selectedModelId,
    }),
  })
  if (!response.ok) {
    const bodyText = redactSecretText(await response.text())
    return { ok: false, provider: 'elevenlabs', code: `ELEVENLABS_HTTP_${response.status}`, message: bodyText.slice(0, 500), httpStatus: response.status, endpoint: '/api/tts/elevenlabs', voiceId: selectedVoiceId, voiceName: selectedVoiceName, modelId: selectedModelId }
  }
  return createTtsResult({ provider: 'elevenlabs', response, ext: 'mp3', voiceId: selectedVoiceId, voiceName: selectedVoiceName, endpoint: '/api/tts/elevenlabs', modelId: selectedModelId, format: selectedOutputFormat })
}

async function callOpenAITts({ text, voiceId, modelId, responseFormat }) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return { ok: false, provider: 'openai', code: 'MISSING_OPENAI_API_KEY', message: 'OPENAI_API_KEY is missing from .env.local', endpoint: '/api/tts/openai', voiceId: voiceId || process.env.OPENAI_TTS_VOICE || 'marin', voiceName: voiceId || process.env.OPENAI_TTS_VOICE || 'marin' }
  }
  const selectedVoice = voiceId || process.env.OPENAI_TTS_VOICE || 'marin'
  const selectedModelId = modelId || process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
  const selectedFormat = responseFormat || process.env.OPENAI_TTS_FORMAT || 'mp3'
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModelId,
      voice: selectedVoice,
      input: text || 'AvatarLink voice quality proof sample.',
      response_format: selectedFormat,
    }),
  })
  if (!response.ok) {
    const bodyText = redactSecretText(await response.text())
    return { ok: false, provider: 'openai', code: `OPENAI_TTS_HTTP_${response.status}`, message: bodyText.slice(0, 500), httpStatus: response.status, endpoint: '/api/tts/openai', voiceId: selectedVoice, voiceName: selectedVoice, modelId: selectedModelId }
  }
  return createTtsResult({ provider: 'openai', response, ext: selectedFormat === 'wav' ? 'wav' : 'mp3', voiceId: selectedVoice, voiceName: selectedVoice, endpoint: '/api/tts/openai', modelId: selectedModelId, format: selectedFormat })
}

async function callCartesiaTts({ text, voiceId, voiceName, modelId }) {
  const key = process.env.CARTESIA_API_KEY
  if (!key) {
    return { ok: false, provider: 'cartesia', code: 'MISSING_CARTESIA_API_KEY', message: 'CARTESIA_API_KEY is missing from .env.local', endpoint: '/api/tts/cartesia', voiceId: voiceId || process.env.CARTESIA_VOICE_ID || 'configure-in-dashboard', voiceName: voiceName || process.env.CARTESIA_VOICE_NAME || 'configure-in-dashboard' }
  }
  const selectedVoiceId = voiceId || process.env.CARTESIA_VOICE_ID
  const selectedVoiceName = voiceName || process.env.CARTESIA_VOICE_NAME || selectedVoiceId || 'configure-in-dashboard'
  if (!selectedVoiceId) {
    return { ok: false, provider: 'cartesia', code: 'MISSING_CARTESIA_VOICE_ID', message: 'CARTESIA_VOICE_ID is missing from .env.local', endpoint: '/api/tts/cartesia', voiceId: 'configure-in-dashboard', voiceName: selectedVoiceName }
  }
  const selectedModelId = modelId || process.env.CARTESIA_MODEL_ID || 'sonic-3'
  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Cartesia-Version': process.env.CARTESIA_API_VERSION || '2026-03-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: selectedModelId,
      transcript: text || 'AvatarLink voice quality proof sample.',
      voice: { mode: 'id', id: selectedVoiceId },
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
      language: 'en',
    }),
  })
  if (!response.ok) {
    const bodyText = redactSecretText(await response.text())
    return { ok: false, provider: 'cartesia', code: `CARTESIA_HTTP_${response.status}`, message: bodyText.slice(0, 500), httpStatus: response.status, endpoint: '/api/tts/cartesia', voiceId: selectedVoiceId, voiceName: selectedVoiceName, modelId: selectedModelId }
  }
  return createTtsResult({ provider: 'cartesia', response, ext: 'mp3', voiceId: selectedVoiceId, voiceName: selectedVoiceName, endpoint: '/api/tts/cartesia', modelId: selectedModelId, format: 'mp3_44100_128' })
}

async function callGemini({ model, systemPrompt, userPrompt }) {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return { ok: false, status: 500, code: 'MISSING_LOCAL_KEY', message: 'GEMINI_API_KEY is missing from .env.local' }
  }
  const selectedModel = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(key)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt || 'You are an AvatarLink companion.'}\n\nUser: ${userPrompt || 'Hello'}` },
          ],
        },
      ],
    }),
  })
  const bodyText = await response.text()
  if (!response.ok) {
    return { ok: false, status: response.status, ...classifyGeminiError(response.status, bodyText) }
  }
  const parsed = JSON.parse(bodyText)
  const text = parsed?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim()
  return { ok: true, text: text || 'Gemini returned an empty response.', model: selectedModel }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1')
  const routePath = requestUrl.pathname.replace(/^\/avatarlink-companion-studio(?=\/api\/)/, '')
  if (req.method === 'OPTIONS') return jsonResponse(res, 204, {})
  if (routePath === '/api/gemini/health') {
    return jsonResponse(res, 200, { ok: true, provider: 'gemini', hasKey: Boolean(process.env.GEMINI_API_KEY), keyExposed: false })
  }
  if (routePath === '/api/github-models/health') {
    return jsonResponse(res, 200, { ok: true, provider: 'github-models', hasKey: Boolean(process.env.GITHUB_TOKEN), keyExposed: false, model: process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4.1-mini' })
  }
  if (routePath === '/api/github-models/generate' && req.method !== 'POST') {
    return jsonResponse(res, 405, { ok: false, code: 'GITHUB_MODELS_METHOD_NOT_ALLOWED', message: 'Use POST /api/github-models/generate with a JSON body. On a static host, set VITE_GITHUB_MODELS_PROXY_BASE or pass githubModelsProxyBase in the URL query so the browser posts to the running safe proxy, not GitHub Pages.' })
  }
  if (routePath === '/api/github-models/generate' && req.method === 'POST') {
    try {
      const payload = await readJson(req)
      const result = await callGithubModels(payload)
      if (result.ok) return jsonResponse(res, 200, result)
      const hermesFallback = await callHermesFallback(payload)
      if (hermesFallback.ok) {
        return jsonResponse(res, 200, {
          ok: true,
          text: hermesFallback.text,
          motionPlan: null,
          model: hermesFallback.model,
          fallbackProvider: 'hermes-openai-codex',
          providerBlocked: { provider: 'github-models', code: result.code, message: result.message },
        })
      }
      return jsonResponse(res, result.status || 502, {
        ok: false,
        code: result.code,
        message: `${result.message}; Hermes fallback also failed: ${hermesFallback.message}`,
        fallbackText: fallbackReply(payload.userPrompt),
      })
    } catch (error) {
      return jsonResponse(res, 500, { ok: false, code: 'GITHUB_MODELS_PROXY_ERROR', message: redactSecretText(error.message) })
    }
  }
  if (routePath === '/api/gemini/generate' && req.method === 'POST') {
    try {
      const payload = await readJson(req)
      const result = await callGemini(payload)
      if (result.ok) return jsonResponse(res, 200, result)
      const hermesFallback = await callHermesFallback(payload)
      if (hermesFallback.ok) {
        return jsonResponse(res, 200, {
          ok: true,
          text: hermesFallback.text,
          motionPlan: null,
          model: hermesFallback.model,
          fallbackProvider: 'hermes-openai-codex',
          geminiBlocked: { code: result.code, message: result.message },
        })
      }
      return jsonResponse(res, result.status || 502, {
        ok: false,
        code: result.code,
        message: `${result.message}; Hermes fallback also failed: ${hermesFallback.message}`,
        fallbackText: fallbackReply(payload.userPrompt),
      })
    } catch (error) {
      return jsonResponse(res, 500, { ok: false, code: 'PROXY_ERROR', message: error.message })
    }
  }
  if (routePath === '/api/tts/health') {
    return jsonResponse(res, 200, {
      ok: true,
      providerKeys: {
        elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
        cartesia: Boolean(process.env.CARTESIA_API_KEY),
      },
      browserVoiceIsFallbackOnly: true,
    })
  }
  if (routePath === '/api/tts/elevenlabs' && req.method === 'POST') {
    const payload = await readJson(req)
    let lastError = null
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await callElevenLabsTts(payload)
        if (result.ok || !/fetch failed|network|terminated|socket|timeout/i.test(result.message || '')) {
          return jsonResponse(res, result.ok ? 200 : result.httpStatus || 503, { ...result, retryAttempt: attempt })
        }
        lastError = new Error(result.message || 'ElevenLabs transient failure')
      } catch (error) {
        lastError = error
      }
      if (attempt < 2) await sleepMs(1200)
    }
    return jsonResponse(res, 500, { ok: false, provider: 'elevenlabs', code: 'ELEVENLABS_PROXY_ERROR', message: redactSecretText(lastError?.message || 'fetch failed after retry'), endpoint: '/api/tts/elevenlabs', retryAttempt: 2 })
  }
  if (routePath === '/api/tts/openai' && req.method === 'POST') {
    try {
      const payload = await readJson(req)
      const result = await callOpenAITts(payload)
      return jsonResponse(res, result.ok ? 200 : result.httpStatus || 503, result)
    } catch (error) {
      return jsonResponse(res, 500, { ok: false, provider: 'openai', code: 'OPENAI_TTS_PROXY_ERROR', message: redactSecretText(error.message), endpoint: '/api/tts/openai' })
    }
  }
  if (routePath === '/api/tts/cartesia' && req.method === 'POST') {
    try {
      const payload = await readJson(req)
      const result = await callCartesiaTts(payload)
      return jsonResponse(res, result.ok ? 200 : result.httpStatus || 503, result)
    } catch (error) {
      return jsonResponse(res, 500, { ok: false, provider: 'cartesia', code: 'CARTESIA_PROXY_ERROR', message: redactSecretText(error.message), endpoint: '/api/tts/cartesia' })
    }
  }
  jsonResponse(res, 404, { ok: false, message: 'Not found' })
})

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`AvatarLink safe model proxy already appears to be running on http://127.0.0.1:${PORT}`)
    process.exit(0)
  }
  console.error(`AvatarLink safe model proxy failed: ${redactSecretText(error?.message || error)}`)
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AvatarLink safe model proxy listening on http://127.0.0.1:${PORT}`)
  console.log(`Gemini key loaded: ${Boolean(process.env.GEMINI_API_KEY)} (secret not printed)`)
  console.log(`GitHub Models token loaded: ${Boolean(process.env.GITHUB_TOKEN)} (secret not printed)`)
})

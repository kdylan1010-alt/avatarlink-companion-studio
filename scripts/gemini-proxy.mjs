import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.GEMINI_PROXY_PORT || 8787)
const PROJECT_ROOT = process.cwd()

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

function jsonResponse(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(payload))
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function fallbackReply(userPrompt) {
  return `AvatarLink local fallback: I heard “${userPrompt || 'your message'}.” Gemini is configured through the safe proxy, but the current Google project is blocked or quota-limited, so the avatar chain continues with local speech and movement.`
}

function classifyGeminiError(status, bodyText) {
  try {
    const parsed = JSON.parse(bodyText)
    const err = parsed.error || {}
    const message = String(err.message || bodyText).replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]')
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
  if (req.method === 'OPTIONS') return jsonResponse(res, 204, {})
  if (req.url === '/api/gemini/health') {
    return jsonResponse(res, 200, { ok: true, hasKey: Boolean(process.env.GEMINI_API_KEY), keyExposed: false })
  }
  if (req.url === '/api/gemini/generate' && req.method === 'POST') {
    try {
      const payload = await readJson(req)
      const result = await callGemini(payload)
      if (result.ok) return jsonResponse(res, 200, result)
      return jsonResponse(res, result.status || 502, {
        ok: false,
        code: result.code,
        message: result.message,
        fallbackText: fallbackReply(payload.userPrompt),
      })
    } catch (error) {
      return jsonResponse(res, 500, { ok: false, code: 'PROXY_ERROR', message: error.message })
    }
  }
  jsonResponse(res, 404, { ok: false, message: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AvatarLink Gemini proxy listening on http://127.0.0.1:${PORT}`)
  console.log(`Gemini key loaded: ${Boolean(process.env.GEMINI_API_KEY)} (secret not printed)`)
})

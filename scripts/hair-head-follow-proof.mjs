#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repo = path.resolve(__dirname, '..')
const distDir = path.join(repo, 'dist')
const publicDir = path.join(repo, 'public')
const artifactsDir = path.join(repo, 'artifacts')
const repoSubpath = '/avatarlink-companion-studio'
const host = '127.0.0.1'
const hairSampleUrl = '/avatars/valid-white-f1-casual.glb'

fs.mkdirSync(artifactsDir, { recursive: true })
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('Missing dist/index.html. Run build first.')
  process.exit(1)
}

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.png', 'image/png'],
  ['.vrm', 'application/octet-stream'], ['.glb', 'model/gltf-binary']
])
function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
  res.end(body)
}
function maybeFile(root, rel) {
  const full = path.normalize(path.join(root, rel))
  if (!full.startsWith(root)) return null
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return null
  return full
}
let port = 0
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`)
    let file = null
    if (url.pathname === repoSubpath || url.pathname === repoSubpath + '/') file = path.join(distDir, 'index.html')
    else if (url.pathname.startsWith(repoSubpath + '/')) {
      const rel = decodeURIComponent(url.pathname.slice((repoSubpath + '/').length))
      file = maybeFile(distDir, rel) || path.join(distDir, 'index.html')
    } else if (url.pathname.startsWith('/avatars/')) file = maybeFile(publicDir, decodeURIComponent(url.pathname.slice(1)))
    if (!file) return send(res, 404, 'not found')
    const ext = path.extname(file).toLowerCase()
    res.writeHead(200, { 'Content-Type': mime.get(ext) || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
    fs.createReadStream(file).pipe(res)
  } catch (err) { send(res, 500, String(err?.stack || err)) }
})

function peakMax(peaks = {}) {
  let max = 0
  for (const value of Object.values(peaks || {})) {
    if (typeof value === 'number') max = Math.max(max, Math.abs(value))
    else if (value && typeof value === 'object') {
      for (const axisValue of Object.values(value)) if (typeof axisValue === 'number') max = Math.max(max, Math.abs(axisValue))
    }
  }
  return max
}

;(async () => {
  const startedAt = new Date().toISOString()
  await new Promise((resolve) => server.listen(0, host, resolve))
  port = server.address().port
  const appUrl = `http://${host}:${port}${repoSubpath}/`
  const screenshotPath = path.join(artifactsDir, 'hair-head-follow-proof.png')
  const jsonPath = path.join(artifactsDir, 'hair-head-follow-proof.json')
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } })
  const consoleLines = []
  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err?.stack || err}`))
  try {
    await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForFunction(() => Boolean(window.__avatarlinkRuntime?.loadUrl && window.__avatarlinkRuntime?.getHairMotionSnapshot), null, { timeout: 30000 })
    const result = await page.evaluate(async ({ hairSampleUrl }) => {
      const runtime = window.__avatarlinkRuntime
      const loadResult = await runtime.loadUrl(`${location.origin}${hairSampleUrl}`)
      await new Promise((resolve) => setTimeout(resolve, 500))
      const before = runtime.getHairMotionSnapshot()
      try { runtime.setAvatarMood('speaking') } catch {}
      runtime.applyMotionPlan({
        movement_cues: [
          { time: 0, part: 'head', action: 'nod', intensity: 1.25, duration: 1400 },
          { time: 0, part: 'body', action: 'lean', intensity: 0.5, duration: 1400 }
        ],
        cues: [{ startMs: 0, durationMs: 1700, mood: 'speaking', text: 'hair follows head proof', body: { head: 1.35, hair: 2.0, body: 0.65 } }]
      }, 'hair follows head proof')
      const samples = []
      for (let i = 0; i < 10; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 180))
        samples.push(runtime.getHairMotionSnapshot())
      }
      const after = samples.at(-1)
      return { loadResult, before, samples, after, bodyText: document.body.innerText.slice(0, 800) }
    }, { hairSampleUrl })
    await page.screenshot({ path: screenshotPath, fullPage: true })
    const allPeaks = Object.assign({}, ...result.samples.map((s) => s.proceduralPeakDegrees || {}))
    const maxHairPeakDeg = peakMax(allPeaks)
    const maxFollowError = Math.max(...result.samples.map((s) => Number(s.maxHeadFollowError ?? 0)).filter(Number.isFinite), 0)
    const hairBoneCount = Number(result.after?.hairBoneCount || 0)
    const hasHeadAnchor = result.samples.some((s) => (s.followSamples || []).some((sample) => sample.hasHeadAnchor))
    const passed = hairBoneCount > 0 && maxHairPeakDeg >= 2.0 && hasHeadAnchor && maxFollowError <= 0.08 && result.after?.rootMotionGuard === 'root-transform-stays-fixed'
    const output = {
      startedAt,
      finishedAt: new Date().toISOString(),
      appUrl,
      hairSampleUrl,
      screenshotPath,
      passed,
      checks: {
        hairBoneCountPositive: hairBoneCount > 0,
        hairPeakAtLeast2Deg: maxHairPeakDeg >= 2.0,
        hasHeadAnchor,
        maxHeadFollowErrorSmall: maxFollowError <= 0.08,
        rootGuardFixed: result.after?.rootMotionGuard === 'root-transform-stays-fixed',
      },
      metrics: { hairBoneCount, maxHairPeakDeg: Number(maxHairPeakDeg.toFixed(4)), maxFollowError: Number(maxFollowError.toFixed(6)) },
      consoleTail: consoleLines.slice(-40),
      ...result,
    }
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2))
    console.log(JSON.stringify(output, null, 2))
    if (!passed) process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await new Promise((resolve) => server.close(resolve))
  }
})().catch((err) => { console.error(err?.stack || err); process.exit(1) })

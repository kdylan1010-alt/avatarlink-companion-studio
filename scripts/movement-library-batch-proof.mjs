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

const modelPath = '/avatars/valid-white-f1-casual.glb'
const actions = [
  {
    name: 'reach',
    prompt: 'Reach your hand out to me.',
    movements: [
      { time: 0, part: 'rightHand', action: 'reach', intensity: 1.0, duration: 1180 },
      { time: 40, part: 'body', action: 'reach', intensity: 0.58, duration: 1040 },
    ],
    thresholds: { rightUpperArm: 12, rightLowerArm: 10, rightHand: 8, torso: 2.3 },
  },
  {
    name: 'clap',
    prompt: 'Clap for me twice.',
    movements: [
      { time: 0, part: 'leftHand', action: 'clap', intensity: 1.05, duration: 1200 },
      { time: 0, part: 'rightHand', action: 'clap', intensity: 1.05, duration: 1200 },
      { time: 60, part: 'head', action: 'clap', intensity: 0.52, duration: 980 },
    ],
    thresholds: { leftHand: 10, rightHand: 10, leftLowerArm: 12, rightLowerArm: 12, head: 1.5 },
  },
  {
    name: 'cheer',
    prompt: 'Throw your arms up and cheer!',
    movements: [
      { time: 0, part: 'arms', action: 'cheer', intensity: 1.08, duration: 1300 },
      { time: 0, part: 'head', action: 'cheer', intensity: 0.82, duration: 1080 },
      { time: 40, part: 'body', action: 'cheer', intensity: 0.72, duration: 1200 },
    ],
    thresholds: { leftUpperArm: 16, rightUpperArm: 16, head: 5, torso: 4 },
  },
  {
    name: 'think',
    prompt: 'Think carefully for a second.',
    movements: [
      { time: 0, part: 'rightHand', action: 'think', intensity: 0.95, duration: 1180 },
      { time: 60, part: 'head', action: 'think', intensity: 0.74, duration: 1120 },
    ],
    thresholds: { rightHand: 10, rightLowerArm: 10, head: 4 },
  },
  {
    name: 'surprised-jump',
    prompt: 'React with a surprised jump and flinch.',
    movements: [
      { time: 0, part: 'arms', action: 'surprised-jump', intensity: 1.08, duration: 980 },
      { time: 0, part: 'head', action: 'surprised-jump', intensity: 0.92, duration: 900 },
      { time: 30, part: 'body', action: 'surprised-jump', intensity: 0.82, duration: 940 },
    ],
    thresholds: { leftUpperArm: 10, rightUpperArm: 10, head: 1.5, torso: 2.4 },
  },
  {
    name: 'hand-on-heart',
    prompt: 'Place your hand on your heart sincerely.',
    movements: [
      { time: 0, part: 'rightHand', action: 'hand-on-heart', intensity: 0.94, duration: 1260 },
      { time: 40, part: 'rightArm', action: 'hand-on-heart', intensity: 0.86, duration: 1180 },
      { time: 80, part: 'head', action: 'hand-on-heart', intensity: 0.42, duration: 980 },
      { time: 0, part: 'body', action: 'hand-on-heart', intensity: 0.52, duration: 1180 },
    ],
    thresholds: { rightUpperArm: 10, rightLowerArm: 10, rightHand: 8, torso: 2, head: 1.5 },
  },
]

fs.mkdirSync(artifactsDir, { recursive: true })

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('Missing dist/index.html. Run build first.')
  process.exit(1)
}

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.vrm', 'application/octet-stream'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
])

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}

function maybeFile(root, rel) {
  const full = path.normalize(path.join(root, rel))
  if (!full.startsWith(root)) return null
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return null
  return full
}

function stableRootDelta(before = {}, after = {}) {
  const a = before?.root?.worldPosition || [0, 0, 0]
  const b = after?.root?.worldPosition || [0, 0, 0]
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

let port = 0
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`)
    let file = null
    if (url.pathname === repoSubpath || url.pathname === `${repoSubpath}/`) {
      file = path.join(distDir, 'index.html')
    } else if (url.pathname.startsWith(`${repoSubpath}/`)) {
      const rel = decodeURIComponent(url.pathname.slice((repoSubpath + '/').length))
      file = maybeFile(distDir, rel)
      if (!file) file = path.join(distDir, 'index.html')
    } else if (url.pathname.startsWith('/avatars/')) {
      file = maybeFile(publicDir, decodeURIComponent(url.pathname.slice(1)))
    }
    if (!file) return send(res, 404, 'not found')
    const ext = path.extname(file).toLowerCase()
    res.writeHead(200, { 'Content-Type': mime.get(ext) || 'application/octet-stream', 'Cache-Control': 'no-store' })
    fs.createReadStream(file).pipe(res)
  } catch (err) {
    send(res, 500, String(err?.stack || err))
  }
})

;(async () => {
  await new Promise((resolve) => server.listen(0, host, resolve))
  port = server.address().port
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1000, height: 1400 } })
  const page = await context.newPage()
  const consoleTail = []
  page.on('console', (msg) => consoleTail.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => consoleTail.push(`[pageerror] ${err?.stack || err}`))
  const screenshotPath = path.join(artifactsDir, 'movement-library-batch-proof.png')
  const jsonPath = path.join(artifactsDir, 'movement-library-batch-proof.json')
  try {
    await page.goto(`http://${host}:${port}${repoSubpath}/`, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForFunction(() => Boolean(window.__avatarlinkRuntime?.loadFile && window.__avatarlinkRuntime?.applyMotionPlan), null, { timeout: 30000 })
    const result = await page.evaluate(async ({ modelPath, actions }) => {
      const runtime = window.__avatarlinkRuntime
      const response = await fetch(`${location.origin}${modelPath}`)
      if (!response.ok) throw new Error(`Failed to fetch model ${modelPath}: ${response.status}`)
      const blob = await response.blob()
      const file = new File([blob], modelPath.split('/').pop(), { type: 'model/gltf-binary' })
      await runtime.loadFile(file)
      await new Promise((resolve) => setTimeout(resolve, 700))
      const summary = []
      for (const spec of actions) {
        const before = runtime.getAvatarStabilityFrame?.()
        const parserSummary = runtime.applyMotionPlan({
          format: 'avatar_motion_plan_v1',
          spokenText: spec.prompt,
          movement_cues: spec.movements,
          cues: [
            {
              startMs: 0,
              durationMs: Math.max(...spec.movements.map((movement) => movement.duration)),
              text: spec.prompt,
              mood: 'speaking',
              body: { body: 0.9, head: 1.0, arms: 1.1, hands: 1.1, hair: 1.0, eyes: 0.9 },
              movements: spec.movements,
            },
          ],
        }, spec.prompt)
        await new Promise((resolve) => setTimeout(resolve, 760))
        const snapshotMid = runtime.getProceduralBodyMotionSnapshot?.()
        const frame = runtime.captureCurrentBodyPartFrame?.()
        const stabilityMid = runtime.getAvatarStabilityFrame?.()
        await new Promise((resolve) => setTimeout(resolve, 900))
        const stabilityAfter = runtime.getAvatarStabilityFrame?.()
        summary.push({ name: spec.name, parserSummary, snapshotMid, frame, before, stabilityMid, stabilityAfter, thresholds: spec.thresholds })
      }
      return summary
    }, { modelPath, actions })

    const report = result.map((entry) => {
      const parts = Object.fromEntries((entry.frame || []).map((item) => [item.part, item]))
      const thresholdFailures = Object.entries(entry.thresholds).filter(([part, threshold]) => Number(parts[part]?.quaternionAngleDeltaDeg || 0) < threshold)
      const activeActions = Array.isArray(entry.snapshotMid?.motionPlan?.activeMovements)
        ? [...new Set(entry.snapshotMid.motionPlan.activeMovements.map((item) => item.action))]
        : []
      return {
        name: entry.name,
        parserSummary: entry.parserSummary,
        activeActions,
        rootTransformStaysFixed: entry.stabilityMid?.rootMotionGuard === 'root-transform-stays-fixed' && stableRootDelta(entry.before, entry.stabilityMid) <= 0.001 && stableRootDelta(entry.stabilityMid, entry.stabilityAfter) <= 0.001,
        thresholdFailures,
        partDeltas: Object.fromEntries(Object.keys(entry.thresholds).map((part) => [part, Number(parts[part]?.quaternionAngleDeltaDeg || 0)])),
      }
    })

    const passed = report.every((entry) => entry.activeActions.includes(entry.name) && entry.rootTransformStaysFixed && entry.thresholdFailures.length === 0)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    const output = { passed, report, screenshotPath, consoleTail: consoleTail.slice(-80) }
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2))
    console.log(JSON.stringify(output, null, 2))
    if (!passed) process.exitCode = 1
  } finally {
    await context.close().catch(() => {})
    await browser.close().catch(() => {})
    await new Promise((resolve) => server.close(resolve))
  }
})().catch((err) => {
  console.error(err?.stack || err)
  process.exit(1)
})

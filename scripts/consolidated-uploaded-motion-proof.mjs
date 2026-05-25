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
const videoDir = path.join(artifactsDir, 'videos')
const repoSubpath = '/avatarlink-companion-studio'
const host = '127.0.0.1'
const apiHost = '127.0.0.1'
const apiPort = Number(process.env.AVATARLINK_PROXY_PORT || 8787)
const requestedPort = 0
const modelPath = '/avatars/valid-white-f1-casual.glb'
const vrmPath = '/avatars/sample.vrm'
const prompt = 'Can you wave to me and say hello?'
const externalAppUrl = process.env.AVATARLINK_APP_URL?.trim() || ''

fs.mkdirSync(artifactsDir, { recursive: true })
fs.mkdirSync(videoDir, { recursive: true })

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

function extractGenericWaveFrame(frames = []) {
  const wanted = ['rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'head', 'torso', 'chest']
  const out = {}
  for (const key of wanted) {
    const match = frames.find((frame) => frame.part === key)
    if (match) out[key] = match
  }
  return out
}

function extractVrmWaveFrame(frames = []) {
  const wanted = ['rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'head', 'chest']
  const out = {}
  for (const key of wanted) {
    const match = frames.find((frame) => frame.label === key)
    if (match) out[key] = match
  }
  return out
}

function stableRootDelta(before = {}, after = {}) {
  const a = before?.root?.worldPosition || [0, 0, 0]
  const b = after?.root?.worldPosition || [0, 0, 0]
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

let port = requestedPort
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`)
    if (url.pathname.startsWith(`${repoSubpath}/api/`)) {
      const proxyReq = http.request({
        hostname: apiHost,
        port: apiPort,
        path: url.pathname.slice(repoSubpath.length) + url.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${apiHost}:${apiPort}`,
        },
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, {
          ...proxyRes.headers,
          'cache-control': 'no-store',
        })
        proxyRes.pipe(res)
      })
      proxyReq.on('error', (err) => send(res, 502, `api proxy error: ${err?.message || err}`))
      req.pipe(proxyReq)
      return
    }
    let file = null
    if (url.pathname === repoSubpath || url.pathname === repoSubpath + '/') {
      file = path.join(distDir, 'index.html')
    } else if (url.pathname.startsWith(repoSubpath + '/')) {
      const rel = decodeURIComponent(url.pathname.slice((repoSubpath + '/').length))
      file = maybeFile(distDir, rel)
      if (!file) file = path.join(distDir, 'index.html')
    } else if (url.pathname.startsWith('/avatars/')) {
      file = maybeFile(publicDir, decodeURIComponent(url.pathname.slice(1)))
    }
    if (!file) return send(res, 404, 'not found')
    const ext = path.extname(file).toLowerCase()
    res.writeHead(200, {
      'Content-Type': mime.get(ext) || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    fs.createReadStream(file).pipe(res)
  } catch (err) {
    send(res, 500, String(err?.stack || err))
  }
})

;(async () => {
  const startedAt = new Date().toISOString()
  const screenshotPath = path.join(artifactsDir, 'uploaded-sketchfab-consolidated-proof.png')
  const jsonPath = path.join(artifactsDir, 'uploaded-sketchfab-consolidated-proof.json')
  await new Promise((resolve) => server.listen(requestedPort, host, resolve))
  port = server.address().port
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const context = await browser.newContext({
    viewport: { width: 1000, height: 1400 },
    recordVideo: { dir: videoDir, size: { width: 1000, height: 1400 } },
  })
  const page = await context.newPage()
  const consoleLines = []
  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err?.stack || err}`))

  try {
    const appUrl = externalAppUrl || `http://${host}:${port}${repoSubpath}/`
    await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForFunction(() => Boolean(window.__avatarlinkRuntime?.loadFile && window.__avatarlinkRuntime?.getCameraFramingSnapshot), null, { timeout: 30000 })

    const result = await page.evaluate(async ({ modelPath, vrmPath, prompt }) => {
      const runtime = window.__avatarlinkRuntime
      const loadAbsoluteFile = async (relativePath, fileName, mimeType) => {
        const response = await fetch(`${location.origin}${relativePath}`)
        if (!response.ok) throw new Error(`Failed to fetch model ${relativePath}: ${response.status}`)
        const blob = await response.blob()
        const file = new File([blob], fileName, { type: mimeType })
        return runtime.loadFile(file)
      }
      const apiPath = `${location.origin}${new URL(location.href).pathname.replace(/\/$/, '')}/api/github-models/generate`

      await loadAbsoluteFile(modelPath, modelPath.split('/').pop(), 'model/gltf-binary')
      await new Promise((resolve) => setTimeout(resolve, 500))
      const framing = runtime.getCameraFramingSnapshot?.()
      const stabilityBefore = runtime.getAvatarStabilityFrame?.()
      const generateRes = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4.1-mini',
          systemPrompt: 'You are brief. Reply naturally in one short sentence only.',
          userPrompt: prompt,
        }),
      })
      const generateJson = await generateRes.json()
      if (!generateRes.ok || !generateJson?.ok) {
        throw new Error(`Generate failed: ${generateRes.status} ${JSON.stringify(generateJson)}`)
      }

      const parserSummary = runtime.applyMotionPlan?.(generateJson.motionPlan, generateJson.reply || generateJson.text)
      await new Promise((resolve) => setTimeout(resolve, 780))
      const sketchfabWaveFrame = runtime.captureCurrentBodyPartFrame?.()
      const sketchfabProceduralMid = runtime.getProceduralBodyMotionSnapshot?.()
      const stabilityMid = runtime.getAvatarStabilityFrame?.()
      await new Promise((resolve) => setTimeout(resolve, 1200))
      const stabilityAfter = runtime.getAvatarStabilityFrame?.()

      const sketchfabTextState = {
        bodyText: document.body.innerText,
        reply: generateJson.reply,
        text: generateJson.text,
      }

      await loadAbsoluteFile(vrmPath, vrmPath.split('/').pop(), 'application/octet-stream')
      await new Promise((resolve) => setTimeout(resolve, 700))
      const vrmApply = runtime.applyMotionPlan?.(generateJson.motionPlan, generateJson.reply || generateJson.text)
      await new Promise((resolve) => setTimeout(resolve, 780))
      const vrmWaveFrame = runtime.captureCurrentArmBoneFrame?.()
      const vrmProceduralMid = runtime.getProceduralBodyMotionSnapshot?.()

      return {
        modelPath,
        vrmPath,
        framing,
        parserSummary,
        vrmApply,
        generate: {
          status: generateRes.status,
          ok: Boolean(generateJson?.ok),
          reply: generateJson?.reply,
          text: generateJson?.text,
          emotion: generateJson?.emotion,
          movement_cues: generateJson?.movement_cues,
          speech_cues: generateJson?.speech_cues,
          model: generateJson?.model,
          motionPlan: generateJson?.motionPlan,
        },
        stabilityBefore,
        stabilityMid,
        stabilityAfter,
        sketchfabWaveFrame,
        sketchfabProceduralMid,
        sketchfabTextState,
        vrmWaveFrame,
        vrmProceduralMid,
      }
    }, { modelPath, vrmPath, prompt })

    await page.screenshot({ path: screenshotPath, fullPage: true })
    const videoPath = await page.video().path()

    const cameraZ = Number(result.framing?.cameraPosition?.[2] ?? Number.NaN)
    const lookAtY = Number(result.framing?.lookAt?.[1] ?? Number.NaN)
    const sizeY = Number(result.framing?.size?.[1] ?? Number.NaN)
    const projectedTopY = Number(result.framing?.projected?.top?.[1] ?? Number.NaN)
    const projectedCenterY = Number(result.framing?.projected?.center?.[1] ?? Number.NaN)
    const projectedBottomY = Number(result.framing?.projected?.bottom?.[1] ?? Number.NaN)
    const boxMinY = Number(result.framing?.boxMin?.[1] ?? Number.NaN)
    const upperBodyLookAtMin = Number.isFinite(boxMinY) && Number.isFinite(sizeY) ? boxMinY + sizeY * 0.78 : Number.NaN

    const genericWave = extractGenericWaveFrame(result.sketchfabWaveFrame || [])
    const vrmWave = extractVrmWaveFrame(result.vrmWaveFrame || [])
    const movementCues = Array.isArray(result.generate?.movement_cues) ? result.generate.movement_cues : []
    const motionPlanSpokenText = String(result.generate?.motionPlan?.spokenText || '')
    const reply = String(result.generate?.reply || '')

    const checks = {
      gptGenerateOk: result.generate?.status === 200 && Boolean(result.generate?.ok),
      structuredReply: typeof result.generate?.reply === 'string' && reply.length > 0,
      structuredEmotion: ['happy', 'playful', 'curious', 'calm'].includes(result.generate?.emotion),
      structuredMovementCues: movementCues.length >= 3 && movementCues.some((cue) => cue.part === 'rightHand' && cue.action === 'wave'),
      structuredSpeechCues: result.generate?.speech_cues && typeof result.generate.speech_cues === 'object',
      parserValidation: Number(result.parserSummary?.movementCueCount || 0) >= 3 && Number(result.parserSummary?.cueCount || 0) >= 1,
      replyOnly: reply === String(result.generate?.text || '') && motionPlanSpokenText === reply,
      portraitDistance: Number.isFinite(cameraZ) && cameraZ >= 0.9 && cameraZ <= 1.55,
      upperBodyTarget: Number.isFinite(lookAtY) && Number.isFinite(upperBodyLookAtMin) && lookAtY >= upperBodyLookAtMin,
      projectedOrder: [projectedTopY, projectedCenterY, projectedBottomY].every(Number.isFinite) && projectedTopY > projectedCenterY && projectedCenterY > projectedBottomY,
      headVisible: Number.isFinite(projectedTopY) && projectedTopY <= 1.0 && projectedTopY >= 0.08,
      upperBodyFocus: Number.isFinite(projectedTopY) && Number.isFinite(projectedCenterY) && (projectedTopY - projectedCenterY) >= 1.75,
      lowerBodyCropped: Number.isFinite(projectedBottomY) && projectedBottomY < -1.05,
      sketchfabWaveVisible: Number(genericWave?.rightShoulder?.quaternionAngleDeltaDeg || 0) >= 8 && Number(genericWave?.rightUpperArm?.quaternionAngleDeltaDeg || 0) >= 18 && Number(genericWave?.rightLowerArm?.quaternionAngleDeltaDeg || 0) >= 12 && Number(genericWave?.rightHand?.quaternionAngleDeltaDeg || 0) >= 10,
      sketchfabHeadChestDelta: (Number(genericWave?.head?.quaternionAngleDeltaDeg || 0) >= 3) && ((Number(genericWave?.torso?.quaternionAngleDeltaDeg || 0) >= 3) || (Number(genericWave?.chest?.quaternionAngleDeltaDeg || 0) >= 3)),
      vrmWaveVisible: Number(vrmWave?.rightShoulder?.quaternionAngleDeltaDeg || 0) >= 8 && Number(vrmWave?.rightUpperArm?.quaternionAngleDeltaDeg || 0) >= 18 && Number(vrmWave?.rightLowerArm?.quaternionAngleDeltaDeg || 0) >= 12 && Number(vrmWave?.rightHand?.quaternionAngleDeltaDeg || 0) >= 8,
      vrmHeadChestDelta: Number(vrmWave?.head?.quaternionAngleDeltaDeg || 0) >= 2 && Number(vrmWave?.chest?.quaternionAngleDeltaDeg || 0) >= 2,
      rootTransformStaysFixed: (result.stabilityMid?.rootMotionGuard === 'root-transform-stays-fixed') && stableRootDelta(result.stabilityBefore, result.stabilityMid) <= 0.001 && stableRootDelta(result.stabilityMid, result.stabilityAfter) <= 0.001,
      sketchfabMappingPresent: Array.isArray(result.sketchfabProceduralMid?.availableGenericParts) && result.sketchfabProceduralMid.availableGenericParts.includes('rightUpperArm') && result.sketchfabProceduralMid.availableGenericParts.includes('rightHand'),
      vrmMappingPresent: Array.isArray(result.vrmProceduralMid?.availableVrmBones) && result.vrmProceduralMid.availableVrmBones.includes('rightUpperArm') && result.vrmProceduralMid.availableVrmBones.includes('rightHand'),
      screenshotCaptured: fs.existsSync(screenshotPath),
      videoCaptured: fs.existsSync(videoPath),
    }
    const passed = Object.values(checks).every(Boolean)

    const output = {
      startedAt,
      finishedAt: new Date().toISOString(),
      url: appUrl,
      prompt,
      screenshotPath,
      videoPath,
      passed,
      checks,
      metrics: {
        cameraZ,
        lookAtY,
        sizeY,
        projectedTopY,
        projectedCenterY,
        projectedBottomY,
        upperBodyLookAtMin,
        rootDeltaBeforeMid: stableRootDelta(result.stabilityBefore, result.stabilityMid),
        rootDeltaMidAfter: stableRootDelta(result.stabilityMid, result.stabilityAfter),
      },
      genericWave,
      vrmWave,
      consoleTail: consoleLines.slice(-80),
      ...result,
    }

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

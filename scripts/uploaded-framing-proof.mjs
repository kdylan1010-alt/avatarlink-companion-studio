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
const requestedPort = 0
const modelPath = '/avatars/valid-white-f1-casual.glb'

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

let port = requestedPort
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`)
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
  const screenshotPath = path.join(artifactsDir, 'uploaded-sketchfab-framing-proof.png')
  const jsonPath = path.join(artifactsDir, 'uploaded-sketchfab-framing-proof.json')
  await new Promise((resolve) => server.listen(requestedPort, host, resolve))
  port = server.address().port
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } })
  const consoleLines = []
  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err?.stack || err}`))

  try {
    const appUrl = `http://${host}:${port}${repoSubpath}/`
    await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForFunction(() => Boolean(window.__avatarlinkRuntime?.loadFile && window.__avatarlinkRuntime?.getCameraFramingSnapshot), null, { timeout: 30000 })

    const result = await page.evaluate(async ({ modelPath }) => {
      const runtime = window.__avatarlinkRuntime
      const absoluteModelUrl = `${location.origin}${modelPath}`
      const response = await fetch(absoluteModelUrl)
      if (!response.ok) throw new Error(`Failed to fetch upload model ${absoluteModelUrl}: ${response.status}`)
      const blob = await response.blob()
      const file = new File([blob], modelPath.split('/').pop(), { type: 'model/gltf-binary' })
      const loadResult = await runtime.loadFile(file)
      await new Promise((resolve) => setTimeout(resolve, 400))
      const framing = runtime.getCameraFramingSnapshot()
      return {
        modelPath,
        loadResult,
        framing,
        bodyText: document.body.innerText,
      }
    }, { modelPath })

    await page.screenshot({ path: screenshotPath, fullPage: true })

    const cameraZ = Number(result.framing?.cameraPosition?.[2] ?? Number.NaN)
    const lookAtY = Number(result.framing?.lookAt?.[1] ?? Number.NaN)
    const sizeY = Number(result.framing?.size?.[1] ?? Number.NaN)
    const projectedTopY = Number(result.framing?.projected?.top?.[1] ?? Number.NaN)
    const projectedCenterY = Number(result.framing?.projected?.center?.[1] ?? Number.NaN)
    const projectedBottomY = Number(result.framing?.projected?.bottom?.[1] ?? Number.NaN)

    const boxMinY = Number(result.framing?.boxMin?.[1] ?? Number.NaN)
    const boxMaxY = Number(result.framing?.boxMax?.[1] ?? Number.NaN)
    const upperBodyLookAtMin = Number.isFinite(boxMinY) && Number.isFinite(sizeY)
      ? boxMinY + sizeY * 0.78
      : Number.NaN

    const checks = {
      uploadLoaded: /loaded|rendered|glb|gltf/i.test(JSON.stringify(result.loadResult || {})),
      // Portrait framing must bias toward a head/eyes/chest crop, not a roomy full-body fallback.
      portraitDistance: Number.isFinite(cameraZ) && cameraZ >= 0.9 && cameraZ <= 1.55,
      upperBodyTarget: Number.isFinite(lookAtY) && Number.isFinite(upperBodyLookAtMin) && lookAtY >= upperBodyLookAtMin,
      projectedOrder: [projectedTopY, projectedCenterY, projectedBottomY].every(Number.isFinite)
        && projectedTopY > projectedCenterY
        && projectedCenterY > projectedBottomY,
      headVisible: Number.isFinite(projectedTopY) && projectedTopY <= 1.0 && projectedTopY >= 0.08,
      upperBodyFocus: Number.isFinite(projectedTopY) && Number.isFinite(projectedCenterY)
        && (projectedTopY - projectedCenterY) >= 1.75,
      lowerBodyCropped: Number.isFinite(projectedBottomY) && projectedBottomY < -1.05,
      validHeight: Number.isFinite(sizeY) && sizeY > 1.0,
    }
    const passed = Object.values(checks).every(Boolean)

    const output = {
      startedAt,
      finishedAt: new Date().toISOString(),
      url: appUrl,
      screenshotPath,
      passed,
      checks,
      metrics: {
        cameraZ,
        lookAtY,
        sizeY,
        projectedTopY,
        projectedCenterY,
        projectedBottomY,
        boxMinY,
        boxMaxY,
        upperBodyLookAtMin,
      },
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
})().catch((err) => {
  console.error(err?.stack || err)
  process.exit(1)
})

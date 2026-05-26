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
const host = '127.0.0.1'
const repoSubpath = '/avatarlink-companion-studio'
const artifactsDir = path.join(repo, 'artifacts')
fs.mkdirSync(artifactsDir, { recursive: true })

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
    }
    if (!file) return send(res, 404, 'not found')
    const ext = path.extname(file).toLowerCase()
    res.writeHead(200, { 'Content-Type': mime.get(ext) || 'application/octet-stream', 'Cache-Control': 'no-store' })
    fs.createReadStream(file).pipe(res)
  } catch (err) {
    send(res, 500, String(err?.stack || err))
  }
})

const invalidBase = 'https://<new-tunnel>/api/github-models?token=***'
const localStorageBad = 'https://YOUR-PROXY.example/api/github-models?key=***'

;(async () => {
  await new Promise((resolve) => server.listen(0, host, resolve))
  port = server.address().port
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } })
  const page = await context.newPage()
  const fetches = []
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err?.stack || err)))
  await page.addInitScript(({ localStorageBad }) => {
    window.localStorage.setItem('githubModelsProxyBase', localStorageBad)
  }, { localStorageBad })
  await page.route('**/*', async (route) => {
    const req = route.request()
    if (req.url().includes('/generate')) {
      fetches.push({ url: req.url(), method: req.method() })
    }
    await route.continue()
  })

  const url = `http://${host}:${port}${repoSubpath}/?githubModelsProxyBase=${encodeURIComponent(invalidBase)}`
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  await page.getByLabel('Developer Debugging Mode').click()
  await page.getByTestId('chat-workbench message-and-run-step').getByRole('button', { name: 'Run full demo' }).click()
  await page.waitForTimeout(2500)

  const result = await page.evaluate(() => {
    const body = document.body.innerText
    return {
      stored: window.localStorage.getItem('githubModelsProxyBase'),
      providerStatusShown: body.includes('Provider connector status'),
      body,
    }
  })
  const screenshotPath = path.join(artifactsDir, 'proxy-config-proof.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  const output = {
    invalidBase,
    localStorageBad,
    fetches,
    consoleErrors,
    stored: result.stored,
    screenshotPath,
    passes: {
      queryPlaceholderRejected: result.stored !== invalidBase,
      localStoragePlaceholderRejected: result.stored !== localStorageBad,
      noPlaceholderGenerateFetch: !fetches.some((item) => item.url.includes('<new-tunnel>') || item.url.includes('YOUR-PROXY') || item.url.includes('example')),
      noSecretsPersisted: !(result.stored || '').includes('token=bad') && !(result.stored || '').includes('key=secret'),
      noMisleadingFullDemoComplete: !result.body.includes('Full demo complete') || result.body.includes('failed') || result.body.includes('invalid'),
    },
    bodyExcerpt: result.body.slice(0, 6000),
  }
  output.passed = Object.values(output.passes).every(Boolean)
  console.log(JSON.stringify(output, null, 2))
  if (!output.passed) process.exitCode = 1
  await context.close()
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
})().catch(async (err) => {
  console.error(err?.stack || err)
  await new Promise((resolve) => server.close(resolve))
  process.exit(1)
})

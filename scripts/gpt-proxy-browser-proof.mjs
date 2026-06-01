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
const artifactsDir = path.join(repo, 'artifacts')
fs.mkdirSync(artifactsDir, { recursive: true })
const host = '127.0.0.1'
const repoSubpath = '/avatarlink-companion-studio'

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
const prompts = [
  'Can you wave to me and say hello?',
  'Please give me a quick cheerful welcome and point toward the stage.',
  'Think for a moment, then give me a calm one-line intro.',
]

;(async () => {
  await new Promise((resolve) => server.listen(0, host, resolve))
  port = server.address().port
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } })
  const page = await context.newPage()
  const responses = []
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err?.stack || err)))
  page.on('response', async (response) => {
    if (!response.url().includes('/api/github-models/generate')) return
    let body = {}
    try {
      body = await response.json()
    } catch {
      body = { parseError: true }
    }
    responses.push({
      url: response.url(),
      status: response.status(),
      body,
    })
  })
  await page.addInitScript(({ localStorageBad }) => {
    window.localStorage.setItem('githubModelsProxyBase', localStorageBad)
  }, { localStorageBad })

  const appUrl = `http://${host}:${port}${repoSubpath}/?githubModelsProxyBase=${encodeURIComponent(invalidBase)}`
  await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 45000 })
  await page.getByLabel('Developer Debugging Mode').click()

  const promptBox = page.getByLabel('User test message')
  const runReplyButton = page.getByRole('button', { name: 'Run companion reply' })

  for (const prompt of prompts) {
    const beforeCount = responses.length
    await promptBox.fill(prompt)
    await runReplyButton.click()
    await page.waitForFunction((expected) => window.document.body.innerText.includes(expected), prompt, { timeout: 45000 }).catch(() => {})
    await page.waitForFunction((count) => window.__hermesResponseCount ? window.__hermesResponseCount >= count : true, beforeCount + 1, { timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(2500)
  }

  const result = await page.evaluate(() => ({
    stored: window.localStorage.getItem('githubModelsProxyBase'),
    blockedText: Array.from(document.querySelectorAll('[role="alert"]')).map((node) => node.textContent || '').find((text) => text.includes('Proxy/API config blocked')) || null,
    body: document.body.innerText,
  }))

  const screenshotPath = path.join(artifactsDir, 'gpt-proxy-browser-proof.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  const output = {
    appUrl,
    blockedText: result.blockedText,
    stored: result.stored,
    prompts,
    responses,
    consoleErrors,
    screenshotPath,
  }
  console.log(JSON.stringify(output, null, 2))
  await context.close()
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
})().catch(async (err) => {
  console.error(err?.stack || err)
  await new Promise((resolve) => server.close(resolve))
  process.exit(1)
})

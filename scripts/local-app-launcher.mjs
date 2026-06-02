#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const appRoot = path.resolve(path.dirname(__filename), '..')
const distDir = path.join(appRoot, 'dist')
const publicDir = path.join(appRoot, 'public')
const userDataDir = path.join(os.homedir(), 'Library', 'Application Support', 'AvatarLink Companion Studio')
const artifactsDir = path.join(userDataDir, 'artifacts')
const logsDir = path.join(os.homedir(), 'Library', 'Logs', 'AvatarLink Companion Studio')
const logPath = path.join(logsDir, 'launcher.log')
const repoSubpath = '/avatarlink-companion-studio'
const proxyPort = Number(process.env.AVATARLINK_PROXY_PORT || 8787)
const preferredAppPorts = [8008, 4173, 0]
const host = '127.0.0.1'
const packageEnvPath = path.join(appRoot, '.env.local')
const appSupportEnvPath = path.join(userDataDir, '.env.local')
const bundledNode = path.join(appRoot, 'bin', 'node')
const nodeExec = fs.existsSync(bundledNode) ? bundledNode : process.execPath

fs.mkdirSync(userDataDir, { recursive: true })
fs.mkdirSync(artifactsDir, { recursive: true })
fs.mkdirSync(logsDir, { recursive: true })

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  fs.appendFileSync(logPath, `${line}\n`)
  console.log(line)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

function mimeType(file) {
  const ext = path.extname(file).toLowerCase()
  return new Map([
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
    ['.wasm', 'application/wasm'],
    ['.txt', 'text/plain; charset=utf-8'],
  ]).get(ext) || 'application/octet-stream'
}

function canAccess(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function resolveEnvPath() {
  if (canAccess(packageEnvPath)) return packageEnvPath
  if (canAccess(appSupportEnvPath)) return appSupportEnvPath
  return ''
}

function checkProxyHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${host}:${proxyPort}/api/github-models/health`, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
  })
}

async function ensureProxy() {
  try {
    const existing = await checkProxyHealth()
    if (existing.status === 200) {
      log(`Reusing existing proxy on ${proxyPort}`)
      return { proc: null, reused: true }
    }
  } catch {}

  const envPath = resolveEnvPath()
  if (envPath) {
    log(`Using provider env file at ${envPath}`)
  } else {
    log(`No provider env file found. Expected ${packageEnvPath} or ${appSupportEnvPath}`)
  }
  const proc = spawn(nodeExec, [path.join(appRoot, 'scripts', 'gemini-proxy.mjs')], {
    cwd: appRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PATH: `/usr/local/bin:${process.env.PATH || ''}`,
      AVATARLINK_ENV_PATH: envPath,
      AVATARLINK_USER_DATA_DIR: userDataDir,
      AVATARLINK_ARTIFACTS_DIR: path.join(artifactsDir, 'tts'),
    },
  })
  proc.stdout.on('data', (chunk) => log(`[proxy stdout] ${String(chunk).trim()}`))
  proc.stderr.on('data', (chunk) => log(`[proxy stderr] ${String(chunk).trim()}`))

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const health = await checkProxyHealth()
      if (health.status === 200) {
        log(`Started proxy on ${proxyPort}`)
        return { proc, reused: false }
      }
    } catch {}
    await sleep(500)
  }

  proc.kill('SIGTERM')
  throw new Error(`Local proxy did not become ready on ${proxyPort}`)
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.removeListener('error', reject)
      resolve(server.address().port)
    })
  })
}

async function startStaticServer() {
  if (!canAccess(path.join(distDir, 'index.html'))) {
    throw new Error(`Missing bundled dist/index.html inside ${appRoot}`)
  }

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://${host}`)
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
      res.writeHead(200, { 'Content-Type': mimeType(file), 'Cache-Control': 'no-store' })
      fs.createReadStream(file).pipe(res)
    } catch (error) {
      send(res, 500, String(error?.stack || error))
    }
  })

  for (const candidate of preferredAppPorts) {
    try {
      const port = await listen(server, candidate)
      log(`Static server listening on ${port}`)
      return { server, port }
    } catch (error) {
      if (candidate === 0) throw error
      log(`Port ${candidate} unavailable: ${error.message}`)
    }
  }
  throw new Error('Unable to bind local static server')
}

function openUrl(url) {
  const proc = spawn('/usr/bin/open', [url], { stdio: 'ignore' })
  proc.unref()
}

async function main() {
  log(`Launcher root ${appRoot}`)
  const proxy = await ensureProxy()
  const { server, port } = await startStaticServer()
  const url = `http://${host}:${port}${repoSubpath}/`
  const launchInfoPath = path.join(artifactsDir, 'mac-app-launch.json')
  fs.writeFileSync(launchInfoPath, JSON.stringify({ url, proxyPort, launchedAt: new Date().toISOString(), appRoot }, null, 2))
  log(`Opening ${url}`)
  openUrl(url)

  const shutdown = () => {
    log('Shutting down launcher')
    server.close(() => process.exit(0))
    if (proxy.proc) proxy.proc.kill('SIGTERM')
    setTimeout(() => process.exit(0), 500).unref()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  log(`Launcher failed: ${error.stack || error.message}`)
  process.exit(1)
})

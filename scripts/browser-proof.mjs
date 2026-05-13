#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repo = path.resolve(__dirname, '..');
const distDir = path.join(repo, 'dist');
const publicDir = path.join(repo, 'public');
const artifactsDir = path.join(repo, 'artifacts');
const repoSubpath = '/avatarlink-companion-studio';
const host = '127.0.0.1';
const requestedPort = 0;

fs.mkdirSync(artifactsDir, { recursive: true });

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('Missing dist/index.html. Run build first.');
  process.exit(1);
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
  ['.wasm', 'application/wasm'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function send(res, code, body, type='text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function maybeFile(root, rel) {
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return null;
  return full;
}

let port = requestedPort;
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    let file = null;
    if (url.pathname === repoSubpath || url.pathname === repoSubpath + '/') {
      file = path.join(distDir, 'index.html');
    } else if (url.pathname.startsWith(repoSubpath + '/')) {
      const rel = decodeURIComponent(url.pathname.slice((repoSubpath + '/').length));
      file = maybeFile(distDir, rel);
      if (!file) file = path.join(distDir, 'index.html');
    } else if (url.pathname.startsWith('/avatars/')) {
      file = maybeFile(publicDir, decodeURIComponent(url.pathname.slice(1)));
    }
    if (!file) return send(res, 404, 'not found');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime.get(ext) || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    send(res, 500, String(err?.stack || err));
  }
});

(async () => {
  const screenshotPath = path.join(artifactsDir, 'avatarlink-browser-proof-e2e.png');
  const jsonPath = path.join(artifactsDir, 'avatarlink-browser-proof-e2e.json');
  const armScreenshotPath = path.join(artifactsDir, 'avatarlink-arm-motion-proof.png');
  const armJsonPath = path.join(artifactsDir, 'avatarlink-arm-motion-proof.json');
  const startedAt = new Date().toISOString();
  await new Promise((resolve) => server.listen(requestedPort, host, resolve));
  port = server.address().port;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  const consoleLines = [];
  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err?.stack || err}`));

  try {
    await page.goto(`http://${host}:${port}${repoSubpath}/`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.evaluate(() => {
      window.__proofFetchLog = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const [input, init] = args;
        const url = typeof input === 'string' ? input : input?.url;
        const method = init?.method || (typeof input !== 'string' && input?.method) || 'GET';
        try {
          const res = await originalFetch(...args);
          let model = null;
          try {
            const clone = res.clone();
            const data = await clone.json();
            model = data?.model ?? data?.provider ?? null;
          } catch {}
          window.__proofFetchLog.push({ url, method, status: res.status, model });
          return res;
        } catch (error) {
          window.__proofFetchLog.push({ url, method, error: String(error) });
          throw error;
        }
      };
    });

    const armButton = page.getByRole('button', { name: /Run hands\/arms proof/i }).first();
    await armButton.waitFor({ state: 'visible', timeout: 30000 });
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(1000);
      const sampleReady = await page.evaluate(() => document.body.innerText.includes('Default sample avatar rendered from /avatars/sample.vrm'));
      if (sampleReady) break;
      if (i === 19) throw new Error('Default sample VRM did not finish loading before arm proof');
    }
    await armButton.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: armScreenshotPath, fullPage: true });

    let armCompleted = false;
    for (let i = 0; i < 12; i += 1) {
      await page.waitForTimeout(1000);
      armCompleted = await page.evaluate(() => /hands\/arms proof complete/i.test(document.body.innerText));
      if (armCompleted) break;
    }
    const armSnapshot = await page.evaluate(() => {
      const text = document.body.innerText;
      const labelValue = (label) => {
        const labels = Array.from(document.querySelectorAll('.mono'));
        const node = labels.find((item) => item.textContent?.trim().toLowerCase() === label.toLowerCase());
        return node?.nextElementSibling?.textContent?.trim() || null;
      };
      return {
        handsArmsStatus: labelValue('Hands/arms proof'),
        movementProofStatus: labelValue('Proof status'),
        avatarReactionState: labelValue('Avatar reaction state'),
        renderStatus: labelValue('Render status'),
        loadedAsset: labelValue('Loaded asset'),
        bodyText: text,
      };
    });

    const armOutput = {
      startedAt,
      finishedAt: new Date().toISOString(),
      url: `http://${host}:${port}${repoSubpath}/`,
      screenshotPath: armScreenshotPath,
      armCompleted,
      consoleTail: consoleLines.slice(-40),
      ...armSnapshot,
    };
    fs.writeFileSync(armJsonPath, JSON.stringify(armOutput, null, 2));

    const fullDemoButton = page.getByRole('button', { name: /Run full demo/i }).first();
    await fullDemoButton.waitFor({ state: 'visible', timeout: 30000 });
    await fullDemoButton.click();

    let completed = false;
    for (let i = 0; i < 16; i += 1) {
      await page.waitForTimeout(5000);
      completed = await page.evaluate(() => /full demo complete/i.test(document.body.innerText));
      if (completed) break;
    }
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const fetchLog = window.__proofFetchLog || [];
      const labelValue = (label) => {
        const labels = Array.from(document.querySelectorAll('.mono'));
        const node = labels.find((item) => item.textContent?.trim().toLowerCase() === label.toLowerCase());
        return node?.nextElementSibling?.textContent?.trim() || null;
      };
      return {
        pageTitle: document.title,
        text,
        fetchLog,
        proofStatus: labelValue('Proof status'),
        runtimeStatus: labelValue('Chat reaction proof'),
        renderStatus: labelValue('Render status'),
        providerPath: labelValue('Last provider path'),
        speechStatus: labelValue('Browser/system speech is fallback only — backend TTS provider not configured yet') || labelValue('Speech status'),
        playbackStatus: labelValue('Playback driver status'),
        avatarState: labelValue('Avatar reaction state'),
        mouthOpen: labelValue('Mouth-open signal'),
        handsArmsStatus: labelValue('Hands/arms proof'),
        visibleProxyOk: text.includes('AVATARLINK_GITHUB_PROXY_OK'),
        visibleProviderOk: text.includes('GITHUB_MODELS_OK') || text.includes('AVATARLINK_GITHUB_PROXY_OK')
      };
    });

    const proxyCall = result.fetchLog.find((x) => String(x.url || '').includes('/api/github-models/generate')) || null;
    const passed = Boolean(
      completed &&
      /full demo complete/i.test(result.text) &&
      /hands\/arms proof complete/i.test(result.text) &&
      result.text.includes('full-demo:live-githubModels:openai/gpt-4.1-mini') &&
      result.text.includes('Speech complete — avatar returned to idle') &&
      proxyCall?.status === 200
    );

    const output = {
      startedAt,
      finishedAt: new Date().toISOString(),
      url: `http://${host}:${port}${repoSubpath}/`,
      screenshotPath,
      armScreenshotPath,
      armProofJsonPath: armJsonPath,
      passed,
      proxyCall,
      consoleErrors: consoleLines.filter((line) => /pageerror/i.test(line) || (/\[error\]/i.test(line) && !/favicon/i.test(line))),
      consoleTail: consoleLines.slice(-40),
      ...result,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});

import fs from 'node:fs'

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8')

const checks = [
  ['title', html.includes('AvatarLink Companion Studio')],
  ['safety_onboarding', app.includes('Safety + asset-rights checklist')],
  ['persona_editor', app.includes('Companion persona editor')],
  ['vrm_upload', app.includes('VRM upload + preview shell')],
  ['byok', app.includes('OpenAI-compatible base URL')],
  ['tts_stub', app.includes('TTS adapter stub + mouth movement signal')],
  ['amplitude_meter', css.includes('.meter-wrap')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)

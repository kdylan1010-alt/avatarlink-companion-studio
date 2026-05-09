import fs from 'node:fs'

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const source = [
  '../src/App.jsx',
  '../src/components/SafetyOnboarding.jsx',
  '../src/components/PersonaEditor.jsx',
  '../src/components/VrmStudioPanel.jsx',
  '../src/components/ChatWorkbench.jsx',
  '../src/components/VoicePanel.jsx',
].map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')
const css = fs.readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8')

const checks = [
  ['title', html.includes('AvatarLink Companion Studio')],
  ['safety_onboarding', source.includes('Safety + asset-rights checklist')],
  ['persona_editor', source.includes('Companion persona editor')],
  ['vrm_upload', source.includes('VRM upload + live preview')],
  ['byok', source.includes('OpenAI-compatible base URL')],
  ['tts_stub', source.includes('TTS adapter stub + mouth movement signal')],
  ['mouth_open_mapping', source.includes('Amplitude → mouth-open mapping')],
  ['viseme_timeline', source.includes('Viseme timeline preview')],
  ['viseme_playback', source.includes('Playback driver status')],
  ['audio_frame_analysis', source.includes('Audio frame analysis preview')],
  ['tts_frame_bridge', source.includes('TTS frame source bridge')],
  ['preview_canvas', source.includes('VRM preview canvas') && css.includes('.preview-canvas')],
  ['amplitude_meter', css.includes('.meter-wrap')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)

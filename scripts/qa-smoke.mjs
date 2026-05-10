import fs from 'node:fs'

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const source = [
  '../src/App.jsx',
  '../src/components/SafetyOnboarding.jsx',
  '../src/components/PersonaEditor.jsx',
  '../src/components/VrmStudioPanel.jsx',
  '../src/components/ChatWorkbench.jsx',
  '../src/components/LeadCapturePanel.jsx',
  '../src/components/VrmSmokeTest.jsx',
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
  ['live_tts_ingest', source.includes('Live TTS ingest status')],
  ['ingest_to_viseme_pipeline', source.includes('Ingest-to-viseme pipeline preview')],
  ['provider_tts_contract', source.includes('Provider TTS contract preview')],
  ['provider_response_map', source.includes('Provider response mapping preview')],
  ['companion_runtime_button', source.includes('Run companion reply')],
  ['demo_runtime_mode', source.includes('Demo mode + browser speech fallback')],
  ['voice_selector', source.includes('Voice provider') && source.includes('Voice ID / browser voice')],
  ['runtime_status_panel', source.includes('Companion runtime status') && source.includes('Last assistant response')],
  ['pilot_waitlist_offer', source.includes('Creator pilot waitlist')],
  ['lead_dashboard', source.includes('Recent pilot leads')],
  ['lead_persistence', source.includes('localStorage') && source.includes('Export leads CSV')],
  ['lead_handoff', source.includes('Latest lead handoff') && source.includes('Open follow-up draft')],
  ['lead_queue', source.includes('Lead queue snapshot') && source.includes('send_followup_now')],
  ['lead_delivery_bridge', source.includes('Delivery bridge payload') && source.includes('Export delivery JSON')],
  ['default_sample_vrm', source.includes('/avatars/sample.vrm')],
  ['simulated_upload_proof', source.includes('Run simulated upload proof') && source.includes('simulated upload')],
  ['vrm_smoke_test', source.includes('Standalone default avatar loader')],
  ['preview_canvas', source.includes('VRM preview canvas') && css.includes('.preview-canvas')],
  ['amplitude_meter', css.includes('.meter-wrap')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)

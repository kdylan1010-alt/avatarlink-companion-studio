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
  '../src/lib/vrmRuntime.js',
].map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')
const css = fs.readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8')
const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
const proxySource = fs.readFileSync(new URL('../scripts/gemini-proxy.mjs', import.meta.url), 'utf8')

const checks = [
  ['title', html.includes('AvatarLink Companion Studio')],
  ['safety_onboarding', source.includes('Safety + asset-rights checklist')],
  ['persona_editor', source.includes('Companion persona editor')],
  ['vrm_upload', source.includes('Upload or preview an avatar') && source.includes('.vrm, .glb, .gltf, .fbx, .usdz')],
  ['byok', source.includes('OpenAI-compatible base URL')],
  ['tts_backend_final_path', proxySource.includes('/api/tts/elevenlabs') && proxySource.includes('/api/tts/openai') && proxySource.includes('/api/tts/cartesia') && source.includes('Current browser/system speech is fallback-only')],
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
  ['voice_modes_fallback_only', source.includes('browser-speech (fallback only — not final)') && source.includes('motion-only-fallback (no audio fallback)') && source.includes('Current browser/system speech is fallback-only') && !source.includes('provider-api-todo')],
  ['runtime_status_panel', source.includes('Companion runtime status') && source.includes('Last assistant response')],
  ['github_models_proxy_default', source.includes('GitHub Models (safe local proxy, recommended)') && source.includes('openai/gpt-4.1-mini') && source.includes('Safe proxy selected')],
  ['safe_proxy_key_hidden', source.includes('API key field hidden for safe proxy providers') && source.includes('.env.local server-side only')],

  ['provider_selector', source.includes('Model provider') && source.includes('Mock / test mode (no paid key required)') && source.includes('OpenRouter (OpenAI-compatible, supports :free models)') && source.includes('Gemini API key via local safe proxy') && source.includes('Local Ollama (dev/local)') && source.includes('Official OpenAI API key / project')],
  ['oauth_ready_scaffold', source.includes('OAuth-ready provider connector') && source.includes('Mocked until an official provider OAuth path is confirmed')],
  ['no_chatgpt_session_copy', source.includes('ChatGPT Free/Plus/Pro login is not the same as OpenAI API access') && source.includes('Use official API key/provider key only')],
  ['provider_docs_reference', source.includes('docs/MODEL_PROVIDERS.md')],
  ['gemini_env_placeholder', envExample.includes('VITE_GEMINI_PROXY_BASE=http://127.0.0.1:8787/api/gemini') && envExample.includes('GEMINI_API_KEY belongs in .env.local only')],
  ['gemini_env_runtime', source.includes('Real calls go through the local/server Gemini proxy so the API key stays out of the browser bundle.')],
  ['gemini_openai_compat_base', source.includes('http://127.0.0.1:8787/api/gemini')],
  ['gemini_secret_safe_stub', source.includes('full avatar chain continued with local fallback speech/movement')],
  ['pilot_waitlist_offer', source.includes('Creator pilot waitlist')],
  ['lead_dashboard', source.includes('Recent pilot leads')],
  ['lead_persistence', source.includes('localStorage') && source.includes('Export leads CSV')],
  ['lead_handoff', source.includes('Latest lead handoff') && source.includes('Open follow-up draft')],
  ['lead_queue', source.includes('Lead queue snapshot') && source.includes('send_followup_now')],
  ['lead_delivery_bridge', source.includes('Delivery bridge payload') && source.includes('Export delivery JSON')],
  ['default_sample_vrm', source.includes('/avatars/sample.vrm')],
  ['guided_primary_flow', source.includes('Build and test an AI avatar in four clear steps') && source.includes('guided-primary-flow') && source.includes('Run full demo')],
  ['creator_next_action', source.includes('What to click next') && source.includes('creator-next-action') && source.includes('creator-action-strip') && source.includes('1 Choose avatar') && source.includes('4 Run full demo')],
  ['ordered_creator_workflow', source.includes('ordered-creator-workflow') && source.includes('message-and-run-step') && source.includes('Step 3 + 4 — Message and run')],
  ['developer_debugging_mode', source.includes('Developer Debugging Mode') && source.includes('debugMode') && source.includes('developer-debugging-mode')],
  ['simple_provider_choice', source.includes('creator-provider-choice') && source.includes('Recommended: GitHub Models safe proxy') && source.includes('Turn on Developer Debugging Mode for provider URLs')],
  ['run_demo_click_hint', source.includes('Next click:') && source.includes('Run full demo') && source.includes('animate the face')],
  ['multi_format_upload_ui', source.includes("const IMPORT_ACCEPT = '.vrm,.glb,.gltf,.fbx,.usdz'") && source.includes('bundled GLB preview directly') && source.includes('sketchfab-format-lane')],
  ['sketchfab_conversion_copy', source.includes('Sketchfab format guide') && source.includes('convert/export it to GLB first') && source.includes('multi-file glTF folders should be exported as GLB') && source.includes('sketchfab-conversion-note')],
  ['gltf_loader_runtime', source.includes('loadFile(file)') && source.includes('bundled .glb') && source.includes('embedded .gltf') && source.includes('multi-file glTF folders')],
  ['simulated_upload_proof', source.includes('Run simulated upload proof') && source.includes('simulated upload')],
  ['movement_proof_demo', source.includes('Movement proof demo') && source.includes('Run movement proof demo')],
  ['movement_reaction_states', source.includes('Idle / blink / breathe loop ready') && source.includes('Avatar reaction state') && source.includes('expression change on response')],
  ['movement_head_sway', source.includes('Head sway + breathe loop active')],
  ['movement_chat_reaction_proof', source.includes('Chat reaction proof') && source.includes('Expression/chat state reaction proof')],
  ['movement_hands_arms_button', source.includes('Run hands/arms proof')],
  ['movement_hands_arms_status', source.includes('Hands/arms proof') && source.includes('Explicit shoulder / upperArm / lowerArm / hand motion proof')],
  ['movement_signal_ladder', source.includes('Movement signal ladder') && source.includes('VRM/GLB/glTF → blink/breathe → head sway → mouth test → shoulder/upperArm/lowerArm/hand motion where rigged → response expression')],
  ['movement_replay_button', source.includes('Replay chat reaction')],
  ['movement_idle_reset_proof', source.includes('Idle reset proof') && source.includes('Run idle reset proof')],
  ['movement_mouth_amplitude_proof', source.includes('Mouth amplitude proof') && source.includes('Run mouth amplitude proof')],
  ['full_demo_pipeline', source.includes('Full demo pipeline') && source.includes('Run full demo') && source.includes('provider/mock + chat response + speech + mouth rig')],
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { SafetyOnboarding } from './components/SafetyOnboarding'
import { PersonaEditor } from './components/PersonaEditor'
import { VrmStudioPanel } from './components/VrmStudioPanel'
import { VrmSmokeTest } from './components/VrmSmokeTest'
import { ChatWorkbench } from './components/ChatWorkbench'
import { LeadCapturePanel } from './components/LeadCapturePanel'
import { VoicePanel } from './components/VoicePanel'
import { amplitudeToMouthOpen, normalizeAmplitude } from './lib/audioAmplitude'
import { buildVisemeTimeline } from './lib/visemeTimeline'
import { playVisemeTimeline } from './lib/playVisemeTimeline'
import { analyzeAudioFrames } from './lib/analyzeAudioFrames'
import { createTtsFrameBridge } from './lib/ttsFrameBridge'
import { createLiveTtsIngestState } from './lib/liveTtsIngest'
import { buildIngestToVisemePipeline } from './lib/ingestToVisemePipeline'
import { buildProviderTtsContract } from './lib/providerTtsContract'
import { buildProviderResponseMap } from './lib/providerResponseMap'

const PROVIDER_PRESETS = {
  mock: {
    id: 'mock',
    label: 'Mock / test mode (no paid key required)',
    apiBase: 'https://mock.local/v1',
    model: 'demo-local-companion',
    transport: 'mock',
    authNote: 'Safe local demo path. No ChatGPT cookies, no session scraping, no paid key required.',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (OpenAI-compatible, supports :free models)',
    apiBase: 'https://openrouter.ai/api/v1',
    model: 'openrouter/auto',
    transport: 'openai-compatible',
    authNote: 'Use an official OpenRouter API key. For low-cost testing, choose a current :free model from the OpenRouter catalog.',
  },
  githubModels: {
    id: 'githubModels',
    label: 'GitHub Models via local safe proxy',
    apiBase: 'http://127.0.0.1:8787/api/github-models',
    model: 'openai/gpt-4.1-mini',
    transport: 'local-github-models-proxy',
    authNote: 'Recommended live demo path. Uses GITHUB_TOKEN only in .env.local through the local/server proxy; the browser never receives the token.',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini API key via local safe proxy',
    apiBase: 'http://127.0.0.1:8787/api/gemini',
    model: 'gemini-2.0-flash',
    transport: 'local-gemini-proxy',
    authNote: 'Use a Gemini API key from Google AI Studio through the local/server proxy. The browser never needs to see the raw key.',
  },
  ollama: {
    id: 'ollama',
    label: 'Local Ollama (dev/local)',
    apiBase: 'http://localhost:11434/v1',
    model: 'llama3.2',
    transport: 'openai-compatible',
    authNote: 'Local dev path. No cloud secret is required if your local Ollama server is already running.',
  },
  openai: {
    id: 'openai',
    label: 'Official OpenAI API key / project',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    transport: 'openai-compatible',
    authNote: 'Official API access only. ChatGPT Free/Plus/Pro login is not the same as OpenAI API access.',
  },
  oauthReady: {
    id: 'oauthReady',
    label: 'OAuth-ready provider connector',
    apiBase: 'https://official-provider-oauth.example/v1',
    model: 'provider-oauth-placeholder-model',
    transport: 'mock-oauth',
    authNote: 'Mocked until an official provider OAuth path is confirmed. No cookies, no web-session scraping, no secrets stored in the frontend.',
  },
}

const starterPersona = {
  name: 'Archivist Echo',
  tone: 'Warm, curious, and lightly theatrical',
  boundaries: 'No harassment, no explicit sexual roleplay, no impersonation of real people',
  opener: 'Welcome back. Want to tune your avatar, test a scene, or rehearse a conversation?',
}

const starterFrames = [0.08, 0.22, 0.14, 0.31, 0.28, 0.12]
const starterTimeline = buildVisemeTimeline(starterFrames)
const starterAnalysis = analyzeAudioFrames(starterFrames)
const starterBridge = createTtsFrameBridge(starterFrames)
const starterIngest = createLiveTtsIngestState(starterBridge)
const starterPipeline = buildIngestToVisemePipeline(starterIngest, starterBridge, starterAnalysis)
const starterContract = buildProviderTtsContract({})
const starterResponseMap = buildProviderResponseMap(starterContract)

const PROVIDER_ENV_DEFAULTS = {
  mock: {
    apiBase: PROVIDER_PRESETS.mock.apiBase,
    apiKey: '',
    model: PROVIDER_PRESETS.mock.model,
  },
  openrouter: {
    apiBase: import.meta.env.VITE_OPENROUTER_API_BASE || PROVIDER_PRESETS.openrouter.apiBase,
    apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
    model: import.meta.env.VITE_OPENROUTER_MODEL || PROVIDER_PRESETS.openrouter.model,
  },
  githubModels: {
    apiBase: import.meta.env.VITE_GITHUB_MODELS_PROXY_BASE || PROVIDER_PRESETS.githubModels.apiBase,
    apiKey: '',
    model: import.meta.env.VITE_GITHUB_MODELS_MODEL || PROVIDER_PRESETS.githubModels.model,
  },
  gemini: {
    apiBase: import.meta.env.VITE_GEMINI_PROXY_BASE || PROVIDER_PRESETS.gemini.apiBase,
    apiKey: '',
    model: import.meta.env.VITE_GEMINI_MODEL || PROVIDER_PRESETS.gemini.model,
  },
  ollama: {
    apiBase: import.meta.env.VITE_OLLAMA_API_BASE || PROVIDER_PRESETS.ollama.apiBase,
    apiKey: import.meta.env.VITE_OLLAMA_API_KEY || '',
    model: import.meta.env.VITE_OLLAMA_MODEL || PROVIDER_PRESETS.ollama.model,
  },
  openai: {
    apiBase: import.meta.env.VITE_OPENAI_API_BASE || PROVIDER_PRESETS.openai.apiBase,
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
    model: import.meta.env.VITE_OPENAI_MODEL || PROVIDER_PRESETS.openai.model,
  },
  oauthReady: {
    apiBase: PROVIDER_PRESETS.oauthReady.apiBase,
    apiKey: '',
    model: PROVIDER_PRESETS.oauthReady.model,
  },
}

function getProviderRuntimeDefaults(providerId) {
  return PROVIDER_ENV_DEFAULTS[providerId] || PROVIDER_ENV_DEFAULTS.mock
}

function buildProviderSelectedStatus(providerId, label, hasLocalKey) {
  if (providerId === 'oauthReady') {
    return 'OAuth-ready connector scaffold selected — mocked until an official provider OAuth path is confirmed'
  }
  if (providerId === 'githubModels') {
    return `Provider preset selected: ${label}. Real calls go through the local/server GitHub Models proxy so GITHUB_TOKEN stays out of the browser bundle.`
  }
  if (providerId === 'gemini') {
    return `Provider preset selected: ${label}. Real calls go through the local/server Gemini proxy so the API key stays out of the browser bundle.`
  }
  if (hasLocalKey) {
    return `Provider preset selected: ${label}. Local BYOK key detected from ignored env only.`
  }
  return `Provider preset selected: ${label}`
}

function buildDemoReply(persona, userPrompt) {
  return `${persona.name}: I heard “${userPrompt}.” Let's turn that into a flirty companion moment: greet the fan warmly, tease one premium perk, and invite them into a private follow-up scene.`
}

function buildSpeechFrames(text) {
  const tokens = text.split(/\s+/).filter(Boolean).slice(0, 10)
  const values = tokens.length ? tokens.map((token, index) => Number((0.15 + ((token.length + index) % 5) * 0.14).toFixed(2))) : [0.18, 0.26, 0.34, 0.22]
  return buildVisemeTimeline(values)
}

async function requestCompanionResponse({
  modelProvider,
  providerMeta,
  persona,
  userPrompt,
  systemPromptPreview,
  apiBase,
  apiKey,
  model,
}) {
  if (modelProvider === 'mock' || modelProvider === 'oauthReady') {
    return {
      text: buildDemoReply(persona, userPrompt),
      label: modelProvider === 'mock' ? 'mock' : 'oauth-ready-mock',
      status: `Running via ${providerMeta.label}`,
      live: false,
    }
  }

  if (modelProvider === 'githubModels' || modelProvider === 'gemini') {
    const proxyLabel = modelProvider === 'githubModels' ? 'GitHub Models' : 'Gemini'
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, systemPrompt: systemPromptPreview, userPrompt }),
    })
    const data = await response.json().catch(() => ({}))
    const blocked = data?.providerBlocked || data?.geminiBlocked
    if (response.ok && data?.text && !data?.fallbackProvider && !blocked) {
      return {
        text: data.text.trim(),
        label: `live-${modelProvider}:${data.model || model}`,
        status: `Live ${proxyLabel} response received through safe local proxy (${data.model || model})`,
        live: true,
      }
    }
    const fallbackText = data?.text || data?.fallbackText || buildDemoReply(persona, userPrompt)
    const reason = blocked?.message || data?.message || data?.error || `${proxyLabel} proxy HTTP ${response.status}`
    return {
      text: fallbackText,
      label: `fallback-${modelProvider}:${data?.code || blocked?.code || response.status}`,
      status: `${proxyLabel} blocked (${reason}); full avatar chain continued with local fallback speech/movement`,
      live: false,
    }
  }

  const canAttemptLive = modelProvider === 'ollama' || Boolean(apiKey.trim())
  if (!canAttemptLive) {
    return {
      text: buildDemoReply(persona, userPrompt),
      label: `fallback-${providerMeta.id}`,
      status: `Fallback mock because no live key was provided for ${providerMeta.label}`,
      live: false,
    }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`
  const response = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPromptPreview },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API ${response.status}: ${errorText.slice(0, 220)}`)
  }
  const data = await response.json()
  return {
    text: data?.choices?.[0]?.message?.content?.trim() || 'Empty provider response',
    label: `live-${providerMeta.id}:${model}`,
    status: `Live provider response received via ${providerMeta.label}`,
    live: true,
  }
}

export default function App() {
  const [persona, setPersona] = useState(starterPersona)
  const [modelProvider, setModelProvider] = useState('githubModels')
  const [apiBase, setApiBase] = useState(getProviderRuntimeDefaults('githubModels').apiBase)
  const [apiKey, setApiKey] = useState(getProviderRuntimeDefaults('githubModels').apiKey)
  const [model, setModel] = useState(getProviderRuntimeDefaults('githubModels').model)
  const [uploadedVrmName, setUploadedVrmName] = useState('No avatar loaded yet')
  const [mouthOpen, setMouthOpen] = useState(() => amplitudeToMouthOpen(normalizeAmplitude(starterFrames)))
  const [playbackStatus, setPlaybackStatus] = useState('Idle — playback helper ready')
  const [userPrompt, setUserPrompt] = useState('Draft a welcome scene for a first-time fan.')
  const [assistantResponse, setAssistantResponse] = useState('')
  const [runtimeStatus, setRuntimeStatus] = useState('Waiting for a real or demo companion run')
  const [runtimeProviderLabel, setRuntimeProviderLabel] = useState('demo mode not run yet')
  const [avatarMood, setAvatarMood] = useState('idle')
  const [movementProofStatus, setMovementProofStatus] = useState('Idle / blink / breathe loop ready')
  const [isMovementProofRunning, setIsMovementProofRunning] = useState(false)
  const [voiceProvider, setVoiceProvider] = useState('browser-speech')
  const [voiceId, setVoiceId] = useState('browser-default')
  const [speechStatus, setSpeechStatus] = useState('Browser/system speech is fallback only — backend TTS provider not configured yet')
  const [availableVoices, setAvailableVoices] = useState([{ id: 'browser-default', label: 'browser-default' }])
  const [isRunning, setIsRunning] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const cancelPlaybackRef = useRef(() => {})
  const speechUtteranceRef = useRef(null)
  const visemeTimeline = useMemo(() => starterTimeline, [])
  const audioFrameAnalysis = useMemo(() => starterAnalysis, [])
  const ttsFrameBridge = useMemo(() => starterBridge, [])
  const liveTtsIngest = useMemo(() => starterIngest, [])
  const ingestToVisemePipeline = useMemo(() => starterPipeline, [])
  const providerTtsContract = useMemo(() => starterContract, [])
  const providerResponseMap = useMemo(() => starterResponseMap, [])
  const providerMeta = PROVIDER_PRESETS[modelProvider]

  useEffect(() => {
    return () => {
      cancelPlaybackRef.current?.()
      window.speechSynthesis?.cancel?.()
    }
  }, [])

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices?.() || []
      if (!voices.length) return
      const nextVoices = [{ id: 'browser-default', label: 'browser-default' }, ...voices.map((voice) => ({ id: voice.voiceURI, label: `${voice.name} (${voice.lang})` }))]
      setAvailableVoices(nextVoices)
      setVoiceId((current) => nextVoices.some((voice) => voice.id === current) ? current : nextVoices[0].id)
    }
    loadVoices()
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices)
  }, [])

  const handleProviderChange = (nextProvider) => {
    const preset = PROVIDER_PRESETS[nextProvider]
    const runtimeDefaults = getProviderRuntimeDefaults(nextProvider)
    const hasLocalKey = Boolean(runtimeDefaults.apiKey?.trim())
    setModelProvider(nextProvider)
    setApiBase(runtimeDefaults.apiBase)
    setApiKey(runtimeDefaults.apiKey)
    setModel(runtimeDefaults.model)
    setRuntimeProviderLabel(`${preset.id}:${preset.transport}`)
    setRuntimeStatus(buildProviderSelectedStatus(nextProvider, preset.label, hasLocalKey))
  }

  const handlePlayTimeline = () => {
    cancelPlaybackRef.current?.()
    setAvatarMood('speaking')
    setPlaybackStatus(`Playing viseme timeline preview from ${ttsFrameBridge.source}`)
    cancelPlaybackRef.current = playVisemeTimeline(visemeTimeline, (frame) => {
      setMouthOpen(frame.mouthOpen)
      setPlaybackStatus(`Playing frame at ${frame.timeMs}ms → mouth ${frame.mouthOpen.toFixed(2)}`)
    }, ttsFrameBridge.frameMs)
    const totalMs = Math.max(ttsFrameBridge.frameMs, visemeTimeline.length * ttsFrameBridge.frameMs + 20)
    window.setTimeout(() => {
      setPlaybackStatus('Playback complete — ready to map real or demo speech frames')
      setAvatarMood('idle')
    }, totalMs)
  }

  const systemPromptPreview = useMemo(() => {
    return `You are ${persona.name}. Tone: ${persona.tone}. Boundaries: ${persona.boundaries}. Opening style: ${persona.opener}`
  }, [persona])

  const speakWithFallback = (text, options = {}) => {
    cancelPlaybackRef.current?.()
    setAvatarMood('speaking')
    const timeline = buildSpeechFrames(text)
    cancelPlaybackRef.current = playVisemeTimeline(timeline, (frame) => {
      setMouthOpen(frame.mouthOpen)
      setPlaybackStatus(`Speaking frame at ${frame.timeMs}ms → mouth ${frame.mouthOpen.toFixed(2)}`)
    }, 140)

    if (voiceProvider !== 'browser-speech') {
      setSpeechStatus('Motion-only fallback selected — avatar reaction proof ran without browser speech audio')
      if (options.finalMovementProofStatus) setMovementProofStatus(options.finalMovementProofStatus)
      if (options.finalRuntimeStatus) setRuntimeStatus(options.finalRuntimeStatus)
      window.setTimeout(() => setAvatarMood('celebrate'), 160)
      window.setTimeout(() => setAvatarMood('idle'), 1100)
      return
    }

    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechStatus('Browser speech unavailable — ran lip-sync demo without audio')
      if (options.finalMovementProofStatus) setMovementProofStatus(options.finalMovementProofStatus)
      if (options.finalRuntimeStatus) setRuntimeStatus(options.finalRuntimeStatus)
      window.setTimeout(() => setAvatarMood('celebrate'), 160)
      window.setTimeout(() => setAvatarMood('idle'), 1100)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    speechUtteranceRef.current = utterance
    const voiceMatch = availableVoices.find((voice) => voice.id === voiceId)
    const nativeVoices = window.speechSynthesis.getVoices?.() || []
    if (voiceMatch && voiceMatch.id !== 'browser-default') {
      utterance.voice = nativeVoices.find((voice) => voice.voiceURI === voiceMatch.id) || null
    }
    utterance.onstart = () => setSpeechStatus(`Browser speech speaking via ${voiceMatch?.label || 'browser-default'}`)
    utterance.onend = () => {
      setSpeechStatus(`Browser speech completed via ${voiceMatch?.label || 'browser-default'}`)
      setPlaybackStatus('Speech complete — avatar returned to idle')
      if (options.finalMovementProofStatus) setMovementProofStatus(options.finalMovementProofStatus)
      if (options.finalRuntimeStatus) setRuntimeStatus(options.finalRuntimeStatus)
      setAvatarMood('celebrate')
      setMouthOpen(0.12)
      window.setTimeout(() => setAvatarMood('idle'), 1000)
    }
    utterance.onerror = (event) => {
      setSpeechStatus(`Browser speech error: ${event.error || 'unknown'} — lip-sync demo continued without audio`)
      if (options.finalMovementProofStatus) setMovementProofStatus(options.finalMovementProofStatus)
      if (options.finalRuntimeStatus) setRuntimeStatus(options.finalRuntimeStatus)
      setPlaybackStatus('Speech fallback complete — mouth/expression pipeline kept running without browser audio')
      setAvatarMood('celebrate')
      setMouthOpen(0.12)
      window.setTimeout(() => setAvatarMood('idle'), 1000)
    }
    window.speechSynthesis.speak(utterance)
  }

  const handleRunMovementProof = () => {
    cancelPlaybackRef.current?.()
    setIsMovementProofRunning(true)
    setAvatarMood('listening')
    setMovementProofStatus('Movement proof running: sample VRM loaded, idle/breathe active, amplitude test opening mouth')
    setRuntimeStatus('Movement proof demo running from local amplitude frames')
    setRuntimeProviderLabel('movement-proof:local-amplitude')
    setAssistantResponse('Movement proof response: sample VRM idled, speech frames opened the mouth, and the avatar switched into a response reaction pose.')

    const proofTimeline = buildVisemeTimeline([0.1, 0.2, 0.58, 0.24, 0.68, 0.3, 0.78, 0.22, 0.12])
    cancelPlaybackRef.current = playVisemeTimeline(proofTimeline, (frame) => {
      setMouthOpen(frame.mouthOpen)
      setAvatarMood(frame.mouthOpen > 0.45 ? 'speaking' : 'listening')
      setPlaybackStatus(`Movement proof frame at ${frame.timeMs}ms → mouth ${frame.mouthOpen.toFixed(2)}`)
    }, 120)

    const totalMs = proofTimeline.length * 120 + 40
    window.setTimeout(() => {
      setAvatarMood('celebrate')
      setMovementProofStatus('Movement proof complete — idle/breathe + mouth-open test + expression change on response')
      setRuntimeStatus('Movement proof complete — expression change on response visible')
      setPlaybackStatus('Movement proof complete — avatar returned to reactive idle')
      window.setTimeout(() => setAvatarMood('idle'), 1000)
      setIsMovementProofRunning(false)
    }, totalMs)
  }

  const handleReplayChatReaction = () => {
    cancelPlaybackRef.current?.()
    setAvatarMood('listening')
    setMovementProofStatus('Replay chat reaction running: head sway primed, mouth test queued, response expression latching')
    setRuntimeStatus('Replay chat reaction running from local movement proof controls')
    setRuntimeProviderLabel('movement-proof:chat-replay')
    setAssistantResponse('Replay chat reaction: avatar shifted from listening to speaking, then landed on a happy response pose.')

    const replayTimeline = buildVisemeTimeline([0.14, 0.36, 0.62, 0.2, 0.52, 0.18])
    cancelPlaybackRef.current = playVisemeTimeline(replayTimeline, (frame) => {
      setMouthOpen(frame.mouthOpen)
      setAvatarMood(frame.mouthOpen > 0.4 ? 'speaking' : 'listening')
      setPlaybackStatus(`Replay chat reaction frame at ${frame.timeMs}ms → mouth ${frame.mouthOpen.toFixed(2)}`)
    }, 140)

    const totalMs = replayTimeline.length * 140 + 40
    window.setTimeout(() => {
      setAvatarMood('celebrate')
      setMovementProofStatus('Replay chat reaction complete — head sway, mouth test, and response expression replayed')
      setRuntimeStatus('Replay chat reaction complete — response expression latched after test audio')
      setPlaybackStatus('Replay chat reaction complete — avatar returned to reactive idle')
      window.setTimeout(() => setAvatarMood('idle'), 1000)
    }, totalMs)
  }


  const handleRunIdleResetProof = () => {
    cancelPlaybackRef.current?.()
    setAvatarMood('listening')
    setMovementProofStatus('Idle reset proof running: avatar cycling back to calm idle after response pose')
    setRuntimeStatus('Idle reset proof running from local movement controls')
    setRuntimeProviderLabel('movement-proof:idle-reset')
    setAssistantResponse('Idle reset proof: avatar completed the response pose, then cooled down into a stable idle state.')
    setPlaybackStatus('Idle reset proof armed — settling head sway and mouth back to baseline')

    const resetTimeline = buildVisemeTimeline([0.22, 0.44, 0.16, 0.08, 0.02])
    cancelPlaybackRef.current = playVisemeTimeline(resetTimeline, (frame) => {
      setMouthOpen(frame.mouthOpen)
      setAvatarMood(frame.mouthOpen > 0.18 ? 'listening' : 'idle')
      setPlaybackStatus(`Idle reset proof frame at ${frame.timeMs}ms → mouth ${frame.mouthOpen.toFixed(2)}`)
    }, 150)

    const totalMs = resetTimeline.length * 150 + 80
    window.setTimeout(() => {
      setAvatarMood('idle')
      setMouthOpen(0.02)
      setMovementProofStatus('Idle reset proof complete — avatar returned to calm idle after the chat reaction')
      setRuntimeStatus('Idle reset proof complete — response pose cooled down into stable idle')
      setPlaybackStatus('Idle reset proof complete — idle baseline restored')
    }, totalMs)
  }


  const handleRunMouthAmplitudeProof = () => {
    cancelPlaybackRef.current?.()
    setAvatarMood('speaking')
    setMovementProofStatus('Mouth amplitude proof running: focused mouth-open test driven by audio amplitude frames')
    setRuntimeStatus('Mouth amplitude proof running from local movement controls')
    setRuntimeProviderLabel('movement-proof:mouth-amplitude')
    setAssistantResponse('Mouth amplitude proof: amplitude frames drove the mouth while the avatar held a speaking/listening cycle.')
    setPlaybackStatus('Mouth amplitude proof armed — stepping through audio amplitude frames')

    const amplitudeTimeline = buildVisemeTimeline([0.06, 0.18, 0.42, 0.71, 0.54, 0.29, 0.11])
    cancelPlaybackRef.current = playVisemeTimeline(amplitudeTimeline, (frame) => {
      setMouthOpen(frame.mouthOpen)
      setAvatarMood(frame.mouthOpen > 0.32 ? 'speaking' : 'listening')
      setPlaybackStatus(`Mouth amplitude proof frame at ${frame.timeMs}ms → mouth ${frame.mouthOpen.toFixed(2)}`)
    }, 130)

    const totalMs = amplitudeTimeline.length * 130 + 60
    window.setTimeout(() => {
      setAvatarMood('listening')
      setMovementProofStatus('Mouth amplitude proof complete — audio/amplitude mouth-open proof is visibly driven in the rig')
      setRuntimeStatus('Mouth amplitude proof complete — mouth followed amplitude frames before settling')
      setPlaybackStatus('Mouth amplitude proof complete — amplitude-driven mouth cycle finished')
    }, totalMs)
  }


  const handleRunFullDemo = async () => {
    setIsRunning(true)
    cancelPlaybackRef.current?.()
    setAvatarMood('listening')
    setMovementProofStatus('Full demo pipeline running: sample VRM + voice + provider/mock + chat response + speech + mouth rig')
    setRuntimeStatus('Full demo pipeline running: preparing provider/mock response')
    setPlaybackStatus('Full demo pipeline armed — waiting for response text and speech frames')
    try {
      const providerResult = await requestCompanionResponse({
        modelProvider,
        providerMeta,
        persona,
        userPrompt,
        systemPromptPreview,
        apiBase,
        apiKey,
        model,
      })
      const responseText = providerResult.text
      const providerLabel = `full-demo:${providerResult.label}`
      setRuntimeStatus(`Full demo pipeline: ${providerResult.status}`)

      setAssistantResponse(responseText)
      setRuntimeProviderLabel(providerLabel)
      speakWithFallback(responseText, {
        finalMovementProofStatus: 'Full demo complete — VRM + voice + provider/mock + chat + speech + mouth movement chain visible',
        finalRuntimeStatus: 'Full demo complete — user message produced a spoken response and drove avatar mouth/expression motion',
      })
    } catch (error) {
      setRuntimeStatus(`Full demo pipeline failed: ${error.message}`)
      setRuntimeProviderLabel(`full-demo:${providerMeta.id}:failed`)
      setAssistantResponse('')
      setAvatarMood('idle')
    } finally {
      setIsRunning(false)
    }
  }

  const handleRunCompanion = async () => {
    setIsRunning(true)
    setAvatarMood('listening')
    setRuntimeStatus('Running companion request…')
    try {
      const providerResult = await requestCompanionResponse({
        modelProvider,
        providerMeta,
        persona,
        userPrompt,
        systemPromptPreview,
        apiBase,
        apiKey,
        model,
      })
      const responseText = providerResult.text
      const providerLabel = providerResult.label
      setRuntimeStatus(providerResult.status)

      setAssistantResponse(responseText)
      setRuntimeProviderLabel(providerLabel)
      speakWithFallback(responseText)
    } catch (error) {
      setRuntimeStatus(`Runtime call failed: ${error.message}`)
      setRuntimeProviderLabel(`${providerMeta.id}:live-call-failed`)
      setAssistantResponse('')
      setAvatarMood('idle')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <main className="shell">
      <header className="hero human-card hero-redesign">
        <div>
          <p className="eyebrow">AvatarLink / Avatar Companion Studio</p>
          <h1>Build and test an AI avatar in four clear steps</h1>
          <p className="lede">
            Choose or upload an avatar, pick the model and voice path, type one message, then run the full demo.
            Technical status panels are hidden by default so creators only see what to click next.
          </p>
        </div>
        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(event) => setDebugMode(event.target.checked)}
          />
          <span>Developer Debugging Mode</span>
        </label>
      </header>

      <section className="guided-flow human-card" data-testid="guided-primary-flow">
        <div className="flow-step"><strong>1</strong><span>Upload or use sample avatar</span><small>VRM and bundled GLB preview best; embedded glTF also works.</small></div>
        <div className="flow-step"><strong>2</strong><span>Pick model + voice</span><small>Choose the safe AI proxy and the voice mode without touching secrets.</small></div>
        <div className="flow-step"><strong>3</strong><span>Type a test message</span><small>Keep the prompt simple and creator-facing.</small></div>
        <div className="flow-step"><strong>4</strong><span>Run full demo</span><small>One button drives provider response, voice, mouth, and motion.</small></div>
      </section>

      <section className="next-action-card human-card" data-testid="creator-next-action">
        <div>
          <p className="eyebrow">What to click next</p>
          <h2>Start with the avatar picker, then press Run full demo.</h2>
          <p className="muted">Default mode is the creator path. Turn on Developer Debugging Mode only when you need raw JSON, provider URLs, smoke tests, or proof controls.</p>
        </div>
        <a className="primary-link" href="#avatar-step">Go to Step 1</a>
      </section>

      {debugMode && (
        <section className="debug-panel" data-testid="developer-debugging-mode">
          <div className="section-head">
            <p className="eyebrow">Developer Debugging Mode</p>
            <h2>Advanced QA, onboarding, persona, and lead tools</h2>
          </div>
          <SafetyOnboarding />
          <LeadCapturePanel />
          <VrmSmokeTest />
          <PersonaEditor persona={persona} onChange={setPersona} />
        </section>
      )}

      <section className="grid two-up primary-workflow">
        <VrmStudioPanel
          debugMode={debugMode}
          uploadedVrmName={uploadedVrmName}
          onUploadName={setUploadedVrmName}
          mouthOpen={mouthOpen}
          avatarMood={avatarMood}
          movementProofStatus={movementProofStatus}
          onRunMovementProof={handleRunMovementProof}
          onReplayChatReaction={handleReplayChatReaction}
          onRunIdleResetProof={handleRunIdleResetProof}
          onRunMouthAmplitudeProof={handleRunMouthAmplitudeProof}
          onRunFullDemo={handleRunFullDemo}
          isMovementProofRunning={isMovementProofRunning}
          assistantResponse={assistantResponse}
          runtimeStatus={runtimeStatus}
        />
        <ChatWorkbench
          debugMode={debugMode}
          persona={persona}
          modelProvider={modelProvider}
          onModelProvider={handleProviderChange}
          providerMeta={providerMeta}
          apiBase={apiBase}
          apiKey={apiKey}
          model={model}
          onApiBase={setApiBase}
          onApiKey={setApiKey}
          onModel={setModel}
          systemPromptPreview={systemPromptPreview}
          userPrompt={userPrompt}
          onUserPrompt={setUserPrompt}
          onRunCompanion={handleRunCompanion}
          onRunFullDemo={handleRunFullDemo}
          runtimeStatus={runtimeStatus}
          assistantResponse={assistantResponse}
          runtimeProviderLabel={runtimeProviderLabel}
          isRunning={isRunning}
        />
      </section>

      <section className="grid two-up">
        <VoicePanel
          debugMode={debugMode}
          mouthOpen={mouthOpen}
          onMouthOpenChange={setMouthOpen}
          visemeTimeline={visemeTimeline}
          playbackStatus={playbackStatus}
          onPlayTimeline={handlePlayTimeline}
          audioFrameAnalysis={audioFrameAnalysis}
          ttsFrameBridge={ttsFrameBridge}
          liveTtsIngest={liveTtsIngest}
          ingestToVisemePipeline={ingestToVisemePipeline}
          providerTtsContract={providerTtsContract}
          providerResponseMap={providerResponseMap}
          voiceProvider={voiceProvider}
          onVoiceProviderChange={setVoiceProvider}
          voiceId={voiceId}
          onVoiceIdChange={setVoiceId}
          availableVoices={availableVoices}
          speechStatus={speechStatus}
        />
      </section>
    </main>
  )
}

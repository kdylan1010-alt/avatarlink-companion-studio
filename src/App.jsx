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
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (OpenAI-compatible, supports :free models)',
    apiBase: 'https://openrouter.ai/api/v1',
    model: 'openrouter/auto',
    transport: 'openai-compatible',
    authNote: 'Use an official OpenRouter API key. For low-cost testing, choose a current :free model from the OpenRouter catalog.',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini API key (free-tier friendly scaffold)',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
    transport: 'openai-compatible',
    authNote: 'Use a Gemini API key from Google AI Studio. This app keeps the same BYOK surface and sends OpenAI-style chat requests to the Gemini compatibility endpoint.',
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

function buildDemoReply(persona, userPrompt) {
  return `${persona.name}: I heard “${userPrompt}.” Let's turn that into a flirty companion moment: greet the fan warmly, tease one premium perk, and invite them into a private follow-up scene.`
}

function buildSpeechFrames(text) {
  const tokens = text.split(/\s+/).filter(Boolean).slice(0, 10)
  const values = tokens.length ? tokens.map((token, index) => Number((0.15 + ((token.length + index) % 5) * 0.14).toFixed(2))) : [0.18, 0.26, 0.34, 0.22]
  return buildVisemeTimeline(values)
}

export default function App() {
  const [persona, setPersona] = useState(starterPersona)
  const [modelProvider, setModelProvider] = useState('openrouter')
  const [apiBase, setApiBase] = useState(PROVIDER_PRESETS.openrouter.apiBase)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(PROVIDER_PRESETS.openrouter.model)
  const [uploadedVrmName, setUploadedVrmName] = useState('No VRM loaded yet')
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
  const [speechStatus, setSpeechStatus] = useState('Browser speech fallback ready')
  const [availableVoices, setAvailableVoices] = useState([{ id: 'browser-default', label: 'browser-default' }])
  const [isRunning, setIsRunning] = useState(false)
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
    setModelProvider(nextProvider)
    setApiBase(preset.apiBase)
    setModel(preset.model)
    setRuntimeProviderLabel(`${preset.id}:${preset.transport}`)
    if (nextProvider === 'oauthReady') {
      setRuntimeStatus('OAuth-ready connector scaffold selected — mocked until an official provider OAuth path is confirmed')
    } else {
      setRuntimeStatus(`Provider preset selected: ${preset.label}`)
    }
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

  const speakWithFallback = (text) => {
    cancelPlaybackRef.current?.()
    setAvatarMood('speaking')
    const timeline = buildSpeechFrames(text)
    cancelPlaybackRef.current = playVisemeTimeline(timeline, (frame) => {
      setMouthOpen(frame.mouthOpen)
      setPlaybackStatus(`Speaking frame at ${frame.timeMs}ms → mouth ${frame.mouthOpen.toFixed(2)}`)
    }, 140)

    if (voiceProvider !== 'browser-speech') {
      setSpeechStatus('Provider API TODO selected — lip-sync demo ran without browser speech audio')
      window.setTimeout(() => setAvatarMood('celebrate'), 160)
      window.setTimeout(() => setAvatarMood('idle'), 1100)
      return
    }

    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechStatus('Browser speech unavailable — ran lip-sync demo without audio')
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
      setAvatarMood('celebrate')
      setMouthOpen(0.12)
      window.setTimeout(() => setAvatarMood('idle'), 1000)
    }
    utterance.onerror = (event) => setSpeechStatus(`Browser speech error: ${event.error || 'unknown'}`)
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

  const handleRunCompanion = async () => {
    setIsRunning(true)
    setAvatarMood('listening')
    setRuntimeStatus('Running companion request…')
    try {
      let responseText = ''
      let providerLabel = ''
      const canAttemptLive = modelProvider === 'ollama' || Boolean(apiKey.trim())

      if (modelProvider === 'oauthReady') {
        responseText = buildDemoReply(persona, userPrompt)
        providerLabel = 'oauth-ready-mock'
        setRuntimeStatus('OAuth-ready connector scaffold selected — mocked until an official provider OAuth path is confirmed')
      } else if (canAttemptLive) {
        const headers = {
          'Content-Type': 'application/json',
        }
        if (apiKey.trim()) {
          headers.Authorization = `Bearer ${apiKey.trim()}`
        }
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
        responseText = data?.choices?.[0]?.message?.content?.trim() || 'Empty provider response'
        providerLabel = `live-${providerMeta.id}:${model}`
        setRuntimeStatus(`Live provider response received via ${providerMeta.label}`)
      } else {
        responseText = buildDemoReply(persona, userPrompt)
        providerLabel = 'demo-local-browser-speech'
        setRuntimeStatus('Demo mode reply rendered with browser speech fallback')
      }

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
      <header className="hero human-card">
        <p className="eyebrow">AvatarLink / Avatar Companion Studio</p>
        <h1>No-code VRM/VTuber AI avatar companion engine</h1>
        <p className="lede">
          Browser-native MVP for creator-owned avatar companions: upload a VRM, shape a persona,
          connect your own model endpoint, and prototype speech + lip-sync workflows without shipping secrets.
        </p>
      </header>

      <SafetyOnboarding />

      <LeadCapturePanel />

      <VrmSmokeTest />

      <section className="grid two-up">
        <PersonaEditor persona={persona} onChange={setPersona} />
        <VrmStudioPanel
          uploadedVrmName={uploadedVrmName}
          onUploadName={setUploadedVrmName}
          mouthOpen={mouthOpen}
          avatarMood={avatarMood}
          movementProofStatus={movementProofStatus}
          onRunMovementProof={handleRunMovementProof}
          onReplayChatReaction={handleReplayChatReaction}
          isMovementProofRunning={isMovementProofRunning}
          assistantResponse={assistantResponse}
          runtimeStatus={runtimeStatus}
        />
      </section>

      <section className="grid two-up">
        <ChatWorkbench
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
          runtimeStatus={runtimeStatus}
          assistantResponse={assistantResponse}
          runtimeProviderLabel={runtimeProviderLabel}
          isRunning={isRunning}
        />
        <VoicePanel
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

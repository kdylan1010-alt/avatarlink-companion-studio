import { useEffect, useMemo, useRef, useState } from 'react'
import { SafetyOnboarding } from './components/SafetyOnboarding'
import { PersonaEditor } from './components/PersonaEditor'
import { VrmStudioPanel } from './components/VrmStudioPanel'
import { ChatWorkbench } from './components/ChatWorkbench'
import { VoicePanel } from './components/VoicePanel'
import { amplitudeToMouthOpen, normalizeAmplitude } from './lib/audioAmplitude'
import { buildVisemeTimeline } from './lib/visemeTimeline'
import { playVisemeTimeline } from './lib/playVisemeTimeline'
import { analyzeAudioFrames } from './lib/analyzeAudioFrames'
import { createTtsFrameBridge } from './lib/ttsFrameBridge'
import { createLiveTtsIngestState } from './lib/liveTtsIngest'

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

export default function App() {
  const [persona, setPersona] = useState(starterPersona)
  const [apiBase, setApiBase] = useState('https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [uploadedVrmName, setUploadedVrmName] = useState('No VRM loaded yet')
  const [mouthOpen, setMouthOpen] = useState(() => amplitudeToMouthOpen(normalizeAmplitude(starterFrames)))
  const [playbackStatus, setPlaybackStatus] = useState('Idle — playback helper ready')
  const cancelPlaybackRef = useRef(() => {})
  const visemeTimeline = useMemo(() => starterTimeline, [])
  const audioFrameAnalysis = useMemo(() => starterAnalysis, [])
  const ttsFrameBridge = useMemo(() => starterBridge, [])
  const liveTtsIngest = useMemo(() => starterIngest, [])

  useEffect(() => {
    return () => cancelPlaybackRef.current?.()
  }, [])

  const handlePlayTimeline = () => {
    cancelPlaybackRef.current?.()
    setPlaybackStatus(`Playing viseme timeline preview from ${ttsFrameBridge.source}`)
    cancelPlaybackRef.current = playVisemeTimeline(visemeTimeline, (frame) => {
      setMouthOpen(frame.mouthOpen)
      setPlaybackStatus(`Playing frame at ${frame.timeMs}ms → mouth ${frame.mouthOpen.toFixed(2)}`)
    }, ttsFrameBridge.frameMs)
    const totalMs = Math.max(ttsFrameBridge.frameMs, visemeTimeline.length * ttsFrameBridge.frameMs + 20)
    window.setTimeout(() => {
      setPlaybackStatus('Playback complete — ready to map real TTS frames')
    }, totalMs)
  }

  const systemPromptPreview = useMemo(() => {
    return `You are ${persona.name}. Tone: ${persona.tone}. Boundaries: ${persona.boundaries}. Opening style: ${persona.opener}`
  }, [persona])

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

      <section className="grid two-up">
        <PersonaEditor persona={persona} onChange={setPersona} />
        <VrmStudioPanel
          uploadedVrmName={uploadedVrmName}
          onUploadName={setUploadedVrmName}
          mouthOpen={mouthOpen}
        />
      </section>

      <section className="grid two-up">
        <ChatWorkbench
          persona={persona}
          apiBase={apiBase}
          apiKey={apiKey}
          model={model}
          onApiBase={setApiBase}
          onApiKey={setApiKey}
          onModel={setModel}
          systemPromptPreview={systemPromptPreview}
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
        />
      </section>
    </main>
  )
}

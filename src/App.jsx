import { useMemo, useState } from 'react'
import { SafetyOnboarding } from './components/SafetyOnboarding'
import { PersonaEditor } from './components/PersonaEditor'
import { VrmStudioPanel } from './components/VrmStudioPanel'
import { ChatWorkbench } from './components/ChatWorkbench'
import { VoicePanel } from './components/VoicePanel'

const starterPersona = {
  name: 'Archivist Echo',
  tone: 'Warm, curious, and lightly theatrical',
  boundaries: 'No harassment, no explicit sexual roleplay, no impersonation of real people',
  opener: 'Welcome back. Want to tune your avatar, test a scene, or rehearse a conversation?',
}

export default function App() {
  const [persona, setPersona] = useState(starterPersona)
  const [apiBase, setApiBase] = useState('https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [uploadedVrmName, setUploadedVrmName] = useState('No VRM loaded yet')

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
        <VrmStudioPanel uploadedVrmName={uploadedVrmName} onUploadName={setUploadedVrmName} />
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
        <VoicePanel />
      </section>
    </main>
  )
}

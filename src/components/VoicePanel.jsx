import { amplitudeToMouthOpen, normalizeAmplitude } from '../lib/audioAmplitude'

export function VoicePanel({
  debugMode = false,
  mouthOpen,
  onMouthOpenChange,
  visemeTimeline,
  playbackStatus,
  onPlayTimeline,
  audioFrameAnalysis,
  ttsFrameBridge,
  liveTtsIngest,
  ingestToVisemePipeline,
  providerTtsContract,
  providerResponseMap,
  voiceProvider,
  onVoiceProviderChange,
  voiceId,
  onVoiceIdChange,
  availableVoices,
  speechStatus,
}) {
  const demoFrames = visemeTimeline.map((frame) => Number(frame.mouthOpen.toFixed(2)))
  const derivedAmplitude = normalizeAmplitude(demoFrames)
  const suggestedMouthOpen = amplitudeToMouthOpen(derivedAmplitude)

  return (
    <section className="panel human-card" data-testid="voice-panel">
      <div className="section-head">
        <p className="eyebrow">Step 2 — Voice</p>
        <h2>Choose the voice path</h2>
      </div>
      <div className="preview-card">
        <p className="mono">Voice provider</p>
        <label>
          Voice provider
          <select value={voiceProvider} onChange={(event) => onVoiceProviderChange(event.target.value)}>
            <option value="browser-speech">browser-speech (fallback only — not final)</option>
            <option value="motion-only-fallback">motion-only-fallback (no audio fallback)</option>
          </select>
        </label>
        <label>
          Voice ID / browser voice
          <select value={voiceId} onChange={(event) => onVoiceIdChange(event.target.value)}>
            {availableVoices.map((voice) => (
              <option key={voice.id} value={voice.id}>{voice.label}</option>
            ))}
          </select>
        </label>
        <p className="muted">{speechStatus}</p>
      </div>
      <div className="preview-card">
        <p className="mono">Voice preview</p>
        <p>Current mode: {voiceProvider}. Backend natural TTS remains the final path; browser/system speech is fallback-only.</p>
        <button className="secondary-button" type="button" onClick={onPlayTimeline}>Preview silent mouth timing</button>
      </div>
      {debugMode && (
        <>
          <div className="preview-card">
            <p className="mono">TTS adapter contract</p>
            <pre>{`{
  provider: '${voiceProvider}',
  text: 'Hello from your avatar companion',
  voiceId: '${voiceId}',
  format: 'wav'
}`}</pre>
          </div>
          <div className="preview-card">
            <p className="mono">Amplitude → mouth-open mapping</p>
            <p>Demo RMS amplitude: {derivedAmplitude.toFixed(2)}</p>
            <p>Suggested mouth-open: {suggestedMouthOpen.toFixed(2)}</p>
            <label>
              Mouth-open preview
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={mouthOpen}
                onChange={(event) => onMouthOpenChange(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="preview-card">
            <p className="mono">Viseme timeline preview</p>
            <pre>{JSON.stringify(visemeTimeline, null, 2)}</pre>
          </div>
          <div className="preview-card">
            <p className="mono">Playback driver status</p>
            <p>{playbackStatus}</p>
            <button className="primary-button" type="button" onClick={onPlayTimeline}>Play viseme timeline</button>
          </div>
          <div className="preview-card">
            <p className="mono">Audio frame analysis preview</p>
            <pre>{JSON.stringify(audioFrameAnalysis, null, 2)}</pre>
          </div>
          <div className="preview-card">
            <p className="mono">TTS frame source bridge</p>
            <pre>{JSON.stringify(ttsFrameBridge, null, 2)}</pre>
          </div>
          <div className="preview-card">
            <p className="mono">Live TTS ingest status</p>
            <pre>{JSON.stringify(liveTtsIngest, null, 2)}</pre>
          </div>
          <div className="preview-card">
            <p className="mono">Ingest-to-viseme pipeline preview</p>
            <pre>{JSON.stringify(ingestToVisemePipeline, null, 2)}</pre>
          </div>
          <div className="preview-card">
            <p className="mono">Provider TTS contract preview</p>
            <pre>{JSON.stringify(providerTtsContract, null, 2)}</pre>
          </div>
          <div className="preview-card">
            <p className="mono">Provider response mapping preview</p>
            <pre>{JSON.stringify(providerResponseMap, null, 2)}</pre>
          </div>
        </>
      )}
      <div className="meter-wrap" aria-label="amplitude-preview">
        <div className="meter meter-1"></div>
        <div className="meter meter-2"></div>
        <div className="meter meter-3"></div>
        <div className="meter meter-4"></div>
      </div>
      <p className="muted">Current browser/system speech is fallback-only. Final voice should come from a backend TTS provider endpoint such as /api/tts/elevenlabs, /api/tts/openai, or /api/tts/cartesia so secrets stay server-side.</p>
    </section>
  )
}

import { amplitudeToMouthOpen, normalizeAmplitude } from '../lib/audioAmplitude'

export function VoicePanel({
  mouthOpen,
  onMouthOpenChange,
  visemeTimeline,
  playbackStatus,
  onPlayTimeline,
  audioFrameAnalysis,
  ttsFrameBridge,
  liveTtsIngest,
  ingestToVisemePipeline,
}) {
  const demoFrames = visemeTimeline.map((frame) => Number(frame.mouthOpen.toFixed(2)))
  const derivedAmplitude = normalizeAmplitude(demoFrames)
  const suggestedMouthOpen = amplitudeToMouthOpen(derivedAmplitude)

  return (
    <section className="panel human-card" data-testid="voice-panel">
      <div className="section-head">
        <p className="eyebrow">Voice + motion</p>
        <h2>TTS adapter stub + mouth movement signal</h2>
      </div>
      <div className="preview-card">
        <p className="mono">TTS adapter contract</p>
        <pre>{`{
  provider: 'stub',
  text: 'Hello from your avatar companion',
  voiceId: 'demo-voice',
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
      <div className="meter-wrap" aria-label="amplitude-preview">
        <div className="meter meter-1"></div>
        <div className="meter meter-2"></div>
        <div className="meter meter-3"></div>
        <div className="meter meter-4"></div>
      </div>
      <p className="muted">Current preview signal is wired into the VRM runtime; next step is real audio-frame analysis from TTS playback.</p>
    </section>
  )
}

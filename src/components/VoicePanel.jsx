export function VoicePanel() {
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
      <div className="meter-wrap" aria-label="amplitude-preview">
        <div className="meter meter-1"></div>
        <div className="meter meter-2"></div>
        <div className="meter meter-3"></div>
        <div className="meter meter-4"></div>
      </div>
      <p className="muted">Next step: map RMS amplitude to VRM expression / jaw-open blend shapes in the render loop.</p>
    </section>
  )
}

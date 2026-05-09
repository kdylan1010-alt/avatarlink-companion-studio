export function PersonaEditor({ persona, onChange }) {
  const update = (field, value) => onChange({ ...persona, [field]: value })

  return (
    <section className="panel human-card" data-testid="persona-editor">
      <div className="section-head">
        <p className="eyebrow">Persona</p>
        <h2>Companion persona editor</h2>
      </div>
      <label>Name<input value={persona.name} onChange={(e) => update('name', e.target.value)} /></label>
      <label>Tone<textarea value={persona.tone} onChange={(e) => update('tone', e.target.value)} /></label>
      <label>Boundaries<textarea value={persona.boundaries} onChange={(e) => update('boundaries', e.target.value)} /></label>
      <label>Opening line<textarea value={persona.opener} onChange={(e) => update('opener', e.target.value)} /></label>
    </section>
  )
}

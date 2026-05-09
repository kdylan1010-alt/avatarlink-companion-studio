export function VrmStudioPanel({ uploadedVrmName, onUploadName }) {
  const handleFile = (event) => {
    const file = event.target.files?.[0]
    if (file) onUploadName(file.name)
  }

  return (
    <section className="panel human-card" data-testid="vrm-studio-panel">
      <div className="section-head">
        <p className="eyebrow">Avatar rig</p>
        <h2>VRM upload + preview shell</h2>
      </div>
      <label className="upload-box">
        <span>Drop a .vrm file or choose one manually</span>
        <input type="file" accept=".vrm" onChange={handleFile} />
      </label>
      <div className="preview-card">
        <p className="mono">Loaded asset</p>
        <strong>{uploadedVrmName}</strong>
        <p className="muted">Next step: wire three.js + three-vrm viewer and animation loop in this panel.</p>
      </div>
    </section>
  )
}

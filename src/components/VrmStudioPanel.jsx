import { useEffect, useRef, useState } from 'react'
import { createVrmPreview } from '../lib/vrmRuntime'

export function VrmStudioPanel({ uploadedVrmName, onUploadName, mouthOpen }) {
  const canvasRef = useRef(null)
  const runtimeRef = useRef(null)
  const [renderStatus, setRenderStatus] = useState('Preview canvas booting…')
  const [meta, setMeta] = useState('No VRM metadata yet')

  useEffect(() => {
    let mounted = true

    async function boot() {
      if (!canvasRef.current) return
      runtimeRef.current = await createVrmPreview(canvasRef.current)
      runtimeRef.current.setMouthOpen(mouthOpen)
      if (mounted) setRenderStatus('Preview canvas live — choose a .vrm file to inspect it in-browser')
    }

    boot().catch((error) => {
      if (mounted) setRenderStatus(`Preview failed: ${error.message}`)
    })

    return () => {
      mounted = false
      runtimeRef.current?.destroy()
      runtimeRef.current = null
    }
  }, [])

  useEffect(() => {
    runtimeRef.current?.setMouthOpen(mouthOpen)
  }, [mouthOpen])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    onUploadName(file.name)
    setRenderStatus(`Loading ${file.name}…`)

    try {
      const result = await runtimeRef.current?.loadFile(file)
      setMeta(`${result?.avatarName || file.name} • VRM ${result?.specVersion || 'unknown'}`)
      setRenderStatus('VRM preview rendered in-browser')
    } catch (error) {
      setMeta('VRM metadata unavailable')
      setRenderStatus(`VRM load failed: ${error.message}`)
    }
  }

  return (
    <section className="panel human-card" data-testid="vrm-studio-panel">
      <div className="section-head">
        <p className="eyebrow">Avatar rig</p>
        <h2>VRM upload + live preview</h2>
      </div>
      <label className="upload-box">
        <span>Drop a .vrm file or choose one manually</span>
        <input type="file" accept=".vrm" onChange={handleFile} />
      </label>
      <div className="preview-stage">
        <canvas ref={canvasRef} className="preview-canvas" aria-label="VRM preview canvas" />
      </div>
      <div className="preview-card">
        <p className="mono">Loaded asset</p>
        <strong>{uploadedVrmName}</strong>
        <p className="mono">Mouth-open signal</p>
        <p>{mouthOpen.toFixed(2)}</p>
        <p className="mono">Render status</p>
        <p>{renderStatus}</p>
        <p className="muted">{meta}</p>
      </div>
    </section>
  )
}

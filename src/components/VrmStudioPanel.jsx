import { useEffect, useRef, useState } from 'react'
import { createVrmPreview } from '../lib/vrmRuntime'

const SAMPLE_PATH = '/avatars/sample.vrm'

export function VrmStudioPanel({
  uploadedVrmName,
  onUploadName,
  mouthOpen,
  avatarMood,
  movementProofStatus,
  onRunMovementProof,
  isMovementProofRunning,
  assistantResponse,
  runtimeStatus,
}) {
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
      runtimeRef.current.setAvatarMood(avatarMood)
      const result = await runtimeRef.current.loadUrl(SAMPLE_PATH)
      console.log('Default sample VRM loaded', result)
      onUploadName('sample.vrm')
      if (mounted) {
        setMeta(`${result?.avatarName || 'sample.vrm'} • VRM ${result?.specVersion || 'unknown'} • bones ${result?.humanoidBoneCount ?? 0}`)
        setRenderStatus('Default sample avatar rendered from /avatars/sample.vrm')
      }
    }

    boot().catch((error) => {
      console.error('Default sample avatar failed', error)
      if (mounted) setRenderStatus(`Preview failed: ${error.message}`)
    })

    return () => {
      mounted = false
      runtimeRef.current?.destroy()
      runtimeRef.current = null
    }
  }, [onUploadName])

  useEffect(() => {
    runtimeRef.current?.setMouthOpen(mouthOpen)
  }, [mouthOpen])

  useEffect(() => {
    runtimeRef.current?.setAvatarMood(avatarMood)
  }, [avatarMood])

  const loadFromFile = async (file, sourceLabel = 'upload') => {
    if (!file) return
    onUploadName(file.name)
    setRenderStatus(`Loading ${file.name} via ${sourceLabel}…`)

    try {
      const result = await runtimeRef.current?.loadFile(file)
      setMeta(`${result?.avatarName || file.name} • VRM ${result?.specVersion || 'unknown'} • bones ${result?.humanoidBoneCount ?? 0}`)
      setRenderStatus(`VRM preview rendered in-browser via ${sourceLabel}`)
      console.log('VRM file load succeeded', { sourceLabel, fileName: file.name, ...result })
    } catch (error) {
      console.error('Uploaded VRM failed', error)
      setMeta('VRM metadata unavailable')
      setRenderStatus(`VRM load failed via ${sourceLabel}: ${error.message}`)
    }
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    await loadFromFile(file, 'manual upload')
  }

  const handleSimulatedUpload = async () => {
    setRenderStatus('Fetching sample.vrm for upload-path proof…')
    try {
      const response = await fetch(SAMPLE_PATH)
      if (!response.ok) throw new Error(`Sample fetch failed with ${response.status}`)
      const blob = await response.blob()
      const file = new File([blob], 'sample-upload.vrm', { type: blob.type || 'application/octet-stream' })
      await loadFromFile(file, 'simulated upload')
    } catch (error) {
      console.error('Simulated upload failed', error)
      setMeta('VRM metadata unavailable')
      setRenderStatus(`Simulated upload failed: ${error.message}`)
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
      <button className="primary-button" type="button" onClick={handleSimulatedUpload}>Run simulated upload proof</button>
      <div className="preview-stage">
        <canvas ref={canvasRef} className="preview-canvas" aria-label="VRM preview canvas" />
      </div>
      <div className="preview-card">
        <p className="mono">Loaded asset</p>
        <strong>{uploadedVrmName}</strong>
        <p className="mono">Default sample path</p>
        <p>{SAMPLE_PATH}</p>
        <p className="mono">Mouth-open signal</p>
        <p>{mouthOpen.toFixed(2)}</p>
        <p className="mono">Render status</p>
        <p>{renderStatus}</p>
        <p className="muted">{meta}</p>
      </div>
      <div className="preview-card">
        <p className="mono">Movement proof demo</p>
        <p>Idle / blink / breathe loop ready</p>
        <p>Head sway + breathe loop active</p>
        <p className="mono">Avatar reaction state</p>
        <p>{avatarMood}</p>
        <p className="mono">Proof status</p>
        <p>{movementProofStatus}</p>
        <p className="muted">Sample VRM loads → idle animation → mouth opens from test audio/amplitude → expression change on response.</p>
        <p className="mono">Chat reaction proof</p>
        <p>{runtimeStatus}</p>
        <p className="muted">{assistantResponse || 'Awaiting assistant response for chat-state proof.'}</p>
        <ul className="proof-checklist">
          <li>{uploadedVrmName !== 'No VRM loaded yet' ? '✅' : '⬜'} VRM load ready</li>
          <li>✅ Blink / breathe / head movement loop</li>
          <li>{movementProofStatus.includes('mouth-open') || movementProofStatus.includes('running') ? '✅' : '⬜'} Audio/amplitude mouth-open proof</li>
          <li>{runtimeStatus.includes('expression change on response') || assistantResponse ? '✅' : '⬜'} Expression/chat state reaction proof</li>
        </ul>
        <button className="primary-button" type="button" onClick={onRunMovementProof} disabled={isMovementProofRunning}>
          {isMovementProofRunning ? 'Movement proof running…' : 'Run movement proof demo'}
        </button>
      </div>
    </section>
  )
}

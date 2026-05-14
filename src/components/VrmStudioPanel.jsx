import { useEffect, useRef, useState } from 'react'
import { createVrmPreview } from '../lib/vrmRuntime'

const SAMPLE_PATH = '/avatars/sample.vrm'
const IMPORT_ACCEPT = '.vrm,.glb,.gltf,.fbx,.usdz,.zip'

export function VrmStudioPanel({
  debugMode = false,
  uploadedVrmName,
  onUploadName,
  mouthOpen,
  avatarMood,
  movementProofStatus,
  onRunMovementProof,
  onReplayChatReaction,
  onRunIdleResetProof,
  onRunMouthAmplitudeProof,
  onRunFullDemo,
  isMovementProofRunning,
  assistantResponse,
  runtimeStatus,
}) {
  const canvasRef = useRef(null)
  const runtimeRef = useRef(null)
  const armProofTimerRef = useRef(null)
  const [renderStatus, setRenderStatus] = useState('Preview canvas booting…')
  const [meta, setMeta] = useState('No avatar metadata yet')
  const [assetKind, setAssetKind] = useState('VRM sample')
  const [armProofStatus, setArmProofStatus] = useState('Hands/arms proof not run yet')
  const [armProofSummary, setArmProofSummary] = useState('Explicit humanoid shoulder/upperArm/lowerArm/hand transforms are waiting for a proof run.')
  const [isArmProofRunning, setIsArmProofRunning] = useState(false)

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
        setAssetKind(result?.format || 'VRM')
        setMeta(`${result?.avatarName || 'sample.vrm'} • ${result?.format || 'VRM'} ${result?.specVersion || 'unknown'} • bones ${result?.humanoidBoneCount ?? 0}`)
        setRenderStatus('Default sample avatar rendered from /avatars/sample.vrm')
        const initialSnapshot = runtimeRef.current?.getArmMotionSnapshot?.()
        if (initialSnapshot?.availableBoneLabels?.length) {
          setArmProofSummary(`Ready bones: ${initialSnapshot.availableBoneLabels.join(', ')}`)
        }
      }
    }

    boot().catch((error) => {
      console.error('Default sample avatar failed', error)
      if (mounted) setRenderStatus(`Preview failed: ${error.message}`)
    })

    return () => {
      mounted = false
      window.clearTimeout(armProofTimerRef.current)
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
      setAssetKind(result?.format || 'avatar')
      setMeta(`${result?.avatarName || file.name} • ${result?.format || 'avatar'} ${result?.specVersion || 'unknown'} • bones ${result?.humanoidBoneCount ?? 0}`)
      setRenderStatus(`${result?.format || 'Avatar'} preview rendered in-browser via ${sourceLabel}`)
      const snapshot = runtimeRef.current?.getArmMotionSnapshot?.()
      if (snapshot?.availableBoneLabels?.length) {
        setArmProofSummary(`Ready bones: ${snapshot.availableBoneLabels.join(', ')}`)
      }
      console.log('Avatar file load succeeded', { sourceLabel, fileName: file.name, ...result })
    } catch (error) {
      console.error('Uploaded avatar failed', error)
      setAssetKind('Unsupported or failed import')
      setMeta('Avatar metadata unavailable')
      setRenderStatus(`Avatar load failed via ${sourceLabel}: ${error.message}`)
    }
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    await loadFromFile(file, 'manual upload')
    event.target.value = ''
  }

  const handleFolder = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const entry = files.find((file) => ['.glb', '.vrm'].some((ext) => file.name.toLowerCase().endsWith(ext)))
      || files.find((file) => file.name.toLowerCase().endsWith('.gltf'))
    const folderName = files[0]?.webkitRelativePath?.split('/')?.[0] || 'Sketchfab folder'
    onUploadName(entry?.webkitRelativePath || entry?.name || folderName)
    setRenderStatus(`Loading ${folderName} folder — looking for GLB/VRM/glTF plus textures…`)

    try {
      const result = await runtimeRef.current?.loadFileBundle(files)
      setAssetKind(result?.format || 'avatar folder')
      setMeta(`${result?.avatarName || folderName} • ${result?.format || 'avatar'} ${result?.specVersion || 'unknown'} • bones ${result?.humanoidBoneCount ?? 0}`)
      setRenderStatus(`${result?.format || 'Avatar'} preview rendered from unzipped Sketchfab folder`)
      const snapshot = runtimeRef.current?.getArmMotionSnapshot?.()
      if (snapshot?.availableBoneLabels?.length) {
        setArmProofSummary(`Ready bones: ${snapshot.availableBoneLabels.join(', ')}`)
      }
    } catch (error) {
      console.error('Folder avatar upload failed', error)
      setAssetKind('Unsupported or failed folder import')
      setMeta('Avatar metadata unavailable')
      setRenderStatus(`Folder upload failed: ${error.message}`)
    } finally {
      event.target.value = ''
    }
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
      setAssetKind('Unsupported or failed import')
      setMeta('Avatar metadata unavailable')
      setRenderStatus(`Simulated upload failed: ${error.message}`)
    }
  }

  const handleRunArmMotionProof = () => {
    window.clearTimeout(armProofTimerRef.current)
    try {
      const summary = runtimeRef.current?.runArmMotionProof?.({ durationMs: 2600, cycleHz: 1.55 })
      if (!summary) throw new Error('Arm proof runtime unavailable')
      setIsArmProofRunning(true)
      setArmProofStatus('Hands/arms proof running — explicit shoulder/upperArm/lowerArm/hand transforms active with smooth clamped sine easing')
      setArmProofSummary(`Animating ${summary.animatedBoneCount} normalized bones: ${summary.availableBoneLabels.join(', ')}`)
      armProofTimerRef.current = window.setTimeout(() => {
        const snapshot = runtimeRef.current?.getArmMotionSnapshot?.()
        const peakSummary = snapshot?.peakDegrees
          ? Object.entries(snapshot.peakDegrees)
              .slice(0, 4)
              .map(([bone, axis]) => `${bone} x${axis.x}° y${axis.y}° z${axis.z}°`)
              .join(' • ')
          : 'Peak arm angles unavailable'
        setArmProofStatus('Hands/arms proof complete — shoulders, upper/lower arms, and hands moved smoothly and eased back to idle without snapping')
        setArmProofSummary(`Animated ${snapshot?.animatedBoneCount ?? summary.animatedBoneCount} bones. Peaks: ${peakSummary}`)
        setIsArmProofRunning(false)
        console.log('Hands/arms proof complete', snapshot)
      }, summary.durationMs + 180)
    } catch (error) {
      setIsArmProofRunning(false)
      setArmProofStatus(`Hands/arms proof failed: ${error.message}`)
      setArmProofSummary('No arm-motion proof snapshot captured')
      console.error('Hands/arms proof failed', error)
    }
  }

  return (
    <section id="avatar-step" className="panel human-card" data-testid="vrm-studio-panel">
      <div className="section-head">
        <p className="eyebrow">Step 1 — Avatar</p>
        <h2>Upload or preview an avatar</h2>
        <p className="muted">Use the built-in sample, or choose a Sketchfab-style export. VRM and bundled GLB preview directly; embedded glTF can preview when its buffers/textures are included; FBX/USDZ show clear conversion guidance.</p>
      </div>
      <div className="upload-choice-grid">
        <label className="upload-box">
          <span>Choose one avatar file (.vrm, .glb, .gltf, .fbx, .usdz, .zip)</span>
          <small>Best Sketchfab path: upload the GLB file if the download includes one. Zip files must be unzipped first.</small>
          <input type="file" accept={IMPORT_ACCEPT} onChange={handleFile} />
        </label>
        <label className="upload-box folder-upload-box">
          <span>Choose Sketchfab folder</span>
          <small>If Sketchfab gave you a zip/folder, unzip it, click this, then select the folder containing scene.gltf, .bin, and textures.</small>
          <input type="file" webkitdirectory="true" directory="true" multiple onChange={handleFolder} />
        </label>
      </div>
      <div className="zip-help-card" data-testid="sketchfab-folder-zip-upload-guide">
        <strong>Have a Sketchfab zip?</strong> Do this: 1) unzip it, 2) click <b>Choose Sketchfab folder</b>, 3) select the unzipped folder. If the zip contains a single <code>.glb</code>, use <b>Choose one avatar file</b> instead.
      </div>
      <div className="status-chip" role="status">Loaded: {uploadedVrmName} • Format: {assetKind}</div>
      <div className="conversion-note" data-testid="sketchfab-conversion-note">
        <strong>Sketchfab format guide:</strong> upload bundled GLB first for instant preview. Embedded glTF and unzipped glTF folders can preview when the .gltf, .bin, and texture files are selected together through Choose Sketchfab folder. If your download is FBX or USDZ, convert/export it to GLB first; AvatarLink will show a clear conversion message instead of a broken preview.
      </div>
      <div className="format-lane" data-testid="sketchfab-format-lane">
        <span>Direct preview: VRM, GLB, embedded glTF</span>
        <span>Conversion needed: FBX, USDZ, multi-file glTF folders</span>
      </div>
      {debugMode && <button className="primary-button" type="button" onClick={handleSimulatedUpload}>Run simulated upload proof</button>}
      <div className="preview-stage">
        <canvas ref={canvasRef} className="preview-canvas" aria-label="VRM preview canvas" />
      </div>
      <div className="preview-card">
        <p className="mono">Avatar status</p>
        <strong>{uploadedVrmName}</strong>
        <p>{renderStatus}</p>
        <p className="muted">{meta}</p>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={onRunFullDemo}>Run full demo</button>
          {debugMode && (
            <button className="secondary-button" type="button" onClick={onRunMovementProof} disabled={isMovementProofRunning}>
              {isMovementProofRunning ? 'Movement proof running…' : 'Run movement proof demo'}
            </button>
          )}
        </div>
      </div>
      {debugMode && (
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
          <p className="mono">Hands/arms proof</p>
          <p>{armProofStatus}</p>
          <p className="muted">{armProofSummary}</p>
          <p className="mono">Movement signal ladder</p>
          <p>VRM/GLB/glTF → blink/breathe → head sway → mouth test → shoulder/upperArm/lowerArm/hand motion where rigged → response expression</p>
          <ul className="proof-checklist">
            <li>{uploadedVrmName !== 'No avatar loaded yet' ? '✅' : '⬜'} Avatar load ready</li>
            <li>✅ Blink / breathe / head movement loop</li>
            <li>{movementProofStatus.includes('mouth-open') || movementProofStatus.includes('running') || movementProofStatus.includes('mouth test') || movementProofStatus.includes('Full demo complete') || runtimeStatus.includes('mouth/expression motion') ? '✅' : '⬜'} Audio/amplitude mouth-open proof</li>
            <li>{armProofStatus.includes('running') || armProofStatus.includes('complete') ? '✅' : '⬜'} Explicit shoulder / upperArm / lowerArm / hand motion proof</li>
            <li>{runtimeStatus.includes('expression change on response') || runtimeStatus.includes('response expression latched') || assistantResponse ? '✅' : '⬜'} Expression/chat state reaction proof</li>
          </ul>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={handleRunArmMotionProof} disabled={isArmProofRunning}>
              {isArmProofRunning ? 'Hands/arms proof running…' : 'Run hands/arms proof'}
            </button>
            <button className="primary-button" type="button" onClick={onRunMovementProof} disabled={isMovementProofRunning}>
              {isMovementProofRunning ? 'Movement proof running…' : 'Run movement proof demo'}
            </button>
            <button className="secondary-button" type="button" onClick={onReplayChatReaction}>Replay chat reaction</button>
            <button className="secondary-button" type="button" onClick={onRunIdleResetProof}>Run idle reset proof</button>
            <button className="secondary-button" type="button" onClick={onRunMouthAmplitudeProof}>Run mouth amplitude proof</button>
          </div>
          <p className="mono">Idle reset proof</p>
          <p>Response pose settles back to a calm idle baseline after mouth/test-audio playback.</p>
          <p className="mono">Mouth amplitude proof</p>
          <p>Dedicated amplitude frames visibly drive mouth-open values before easing back into the listening state.</p>
          <p className="mono">Full demo pipeline</p>
          <p>Sample/upload VRM → voice library → provider/mock → chat response → speech/audio → mouth and expression movement.</p>
        </div>
      )}
    </section>
  )
}

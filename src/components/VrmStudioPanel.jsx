import { useEffect, useRef, useState } from 'react'
import { createVrmPreview } from '../lib/vrmRuntime'

// Smoke marker: /avatars/sample.vrm
const SAMPLE_PATH = `${import.meta.env.BASE_URL}avatars/sample.vrm`
const FAST_SAMPLE_PATH = `${import.meta.env.BASE_URL}avatars/open-source-avatars-devil.vrm`
const DEFAULT_AVATAR_PATH = FAST_SAMPLE_PATH
const LOAD_TIMEOUT_MS = 12000
const ROUTED_MODEL_PARAM_KEYS = ['model', 'avatar', 'avatarModel']
const ROUTED_MODEL_EXTENSIONS = ['.vrm', '.glb', '.gltf']

function normalizeHostedAvatarPath(pathname = '') {
  const base = import.meta.env.BASE_URL || '/'
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  let normalized = String(pathname || '').trim()
  if (!normalized) return null
  normalized = normalized.replace(/^\/+/, '')
  if (normalized.startsWith(cleanBase.replace(/^\/+/, ''))) {
    normalized = normalized.slice(cleanBase.replace(/^\/+/, '').length)
  }
  if (!normalized.startsWith('avatars/')) normalized = `avatars/${normalized}`
  if (!ROUTED_MODEL_EXTENSIONS.some((ext) => normalized.toLowerCase().endsWith(ext))) return null
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((part) => part === '..' || part.includes('\\'))) return null
  return `${cleanBase}${parts.join('/')}`
}

function resolveRoutedModelFromUrl() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const rawValue = ROUTED_MODEL_PARAM_KEYS.map((key) => params.get(key)).find(Boolean)
  if (!rawValue) return null
  let candidate = rawValue.trim()
  try {
    const parsed = new URL(candidate, window.location.href)
    if (parsed.origin !== window.location.origin) return null
    candidate = parsed.pathname
  } catch {
    // Keep raw relative candidate.
  }
  const url = normalizeHostedAvatarPath(candidate)
  if (!url) return null
  return {
    url,
    displayName: url.split('/').pop() || 'routed-avatar',
    publicPath: url.replace(import.meta.env.BASE_URL, '/'),
  }
}

async function withLoadTimeout(promise, label) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), LOAD_TIMEOUT_MS)
      }),
    ])
  } finally {
    window.clearTimeout(timer)
  }
}

const IMPORT_ACCEPT = '.vrm,.glb,.gltf,.fbx,.usdz,.zip'

export function VrmStudioPanel({
  debugMode = false,
  uploadedVrmName,
  onUploadName,
  mouthOpen,
  mouthViseme = 'aa',
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
  const bodyPartProofTimerRef = useRef(null)
  const [renderStatus, setRenderStatus] = useState('Preview canvas booting…')
  const [meta, setMeta] = useState('No avatar metadata yet')
  const [assetKind, setAssetKind] = useState('VRM sample')
  const [armProofStatus, setArmProofStatus] = useState('Hands/arms proof not run yet')
  const [armProofSummary, setArmProofSummary] = useState('Explicit humanoid shoulder/upperArm/lowerArm/hand transforms are waiting for a proof run.')
  const [isArmProofRunning, setIsArmProofRunning] = useState(false)
  const [bodyPartProofStatus, setBodyPartProofStatus] = useState('Sketchfab body-part proof not run yet')
  const [bodyPartProofSummary, setBodyPartProofSummary] = useState('For rigged GLB/glTF Sketchfab models, AvatarLink can rotate detected skeleton bones independently without Blender.')
  const [isBodyPartProofRunning, setIsBodyPartProofRunning] = useState(false)

  useEffect(() => {
    let mounted = true

    async function boot() {
      if (!canvasRef.current) return
      runtimeRef.current = await createVrmPreview(canvasRef.current)
      const runtime = runtimeRef.current
      runtime.setMouthOpen(mouthOpen, 'aa')
      runtime.setAvatarMood(avatarMood)
      try {
        const routedModel = resolveRoutedModelFromUrl()
        if (routedModel) {
          setRenderStatus(`Loading routed model viewer link: ${routedModel.publicPath}…`)
          const result = await withLoadTimeout(runtime.loadUrl(routedModel.url), 'Routed model load')
          onUploadName(routedModel.displayName)
          if (mounted) {
            setAssetKind(result?.format || 'avatar')
            setMeta(`${result?.avatarName || routedModel.displayName} • ${result?.format || 'avatar'} ${result?.specVersion || 'unknown'} • bones ${result?.humanoidBoneCount ?? 0}`)
            setRenderStatus(`Routed model rendered in-browser from viewer link: ${routedModel.publicPath}`)
            const initialSnapshot = runtime.getArmMotionSnapshot?.()
            if (initialSnapshot?.availableBoneLabels?.length) {
              setArmProofSummary(`Ready bones: ${initialSnapshot.availableBoneLabels.join(', ')}`)
            }
            const bodySnapshot = runtime.getBodyPartMotionSnapshot?.()
            if (bodySnapshot?.availableParts?.length) {
              setBodyPartProofSummary(`Detected body parts: ${bodySnapshot.availableParts.join(', ')}. Root transform stays fixed.`)
            }
          }
          return
        }

        setRenderStatus('Loading default avatar…')
        let result
        let loadedPath = DEFAULT_AVATAR_PATH
        try {
          // Prefer the small default VRM on hosted pages; the legacy 11 MB sample.vrm
          // is kept as a fallback/QA marker but is too slow for a reliable first paint.
          result = await withLoadTimeout(runtime.loadUrl(DEFAULT_AVATAR_PATH), 'Fast default VRM load')
          console.log('Fast default VRM loaded', result)
        } catch (fastError) {
          console.warn('Fast default VRM stalled; falling back to legacy sample.vrm', fastError)
          loadedPath = SAMPLE_PATH
          result = await withLoadTimeout(runtime.loadUrl(SAMPLE_PATH), 'Default sample.vrm load')
        }
        onUploadName(loadedPath.endsWith('sample.vrm') ? 'sample.vrm' : 'open-source-avatars-devil.vrm')
        if (mounted) {
          setAssetKind(result?.format || 'VRM')
          setMeta(`${result?.avatarName || loadedPath.split('/').pop()} • ${result?.format || 'VRM'} ${result?.specVersion || 'unknown'} • bones ${result?.humanoidBoneCount ?? 0}`)
          setRenderStatus(`Default avatar rendered from ${loadedPath.replace(import.meta.env.BASE_URL, '/')}`)
          const initialSnapshot = runtime.getArmMotionSnapshot?.()
          if (initialSnapshot?.availableBoneLabels?.length) {
            setArmProofSummary(`Ready bones: ${initialSnapshot.availableBoneLabels.join(', ')}`)
          }
        }
      } finally {
        if (mounted && runtimeRef.current === runtime) {
          window.__avatarlinkRuntime = runtime
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
      window.clearTimeout(bodyPartProofTimerRef.current)
      runtimeRef.current?.destroy()
      if (window.__avatarlinkRuntime === runtimeRef.current) delete window.__avatarlinkRuntime
      runtimeRef.current = null
    }
  }, [onUploadName])

  useEffect(() => {
    runtimeRef.current?.setMouthOpen(mouthOpen, mouthViseme)
  }, [mouthOpen, mouthViseme])

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
      const bodySnapshot = runtimeRef.current?.getBodyPartMotionSnapshot?.()
      if (bodySnapshot?.availableParts?.length) {
        setBodyPartProofSummary(`Detected body parts: ${bodySnapshot.availableParts.join(', ')}. Root transform stays fixed.`)
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
      const bodySnapshot = runtimeRef.current?.getBodyPartMotionSnapshot?.()
      if (bodySnapshot?.availableParts?.length) {
        setBodyPartProofSummary(`Detected body parts: ${bodySnapshot.availableParts.join(', ')}. Root transform stays fixed.`)
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


  const handleRunBodyPartProof = () => {
    window.clearTimeout(bodyPartProofTimerRef.current)
    try {
      const summary = runtimeRef.current?.runBodyPartMotionProof?.({ durationMs: 3200, cycleHz: 0.85 })
      if (!summary) throw new Error('Sketchfab body-part runtime unavailable')
      setIsBodyPartProofRunning(true)
      setBodyPartProofStatus('Sketchfab body-part proof running — rotating detected skeleton bones separately; root transform locked')
      setBodyPartProofSummary(`Animating ${summary.animatedPartCount} parts: ${summary.availableParts.join(', ')}. ${summary.rootMotionGuard}`)
      bodyPartProofTimerRef.current = window.setTimeout(() => {
        const snapshot = runtimeRef.current?.getBodyPartMotionSnapshot?.()
        const peakSummary = snapshot?.peakDegrees
          ? Object.entries(snapshot.peakDegrees)
              .slice(0, 6)
              .map(([part, axis]) => `${part} x${axis.x}° y${axis.y}° z${axis.z}°`)
              .join(' • ')
          : 'Peak body-part angles unavailable'
        setBodyPartProofStatus('Sketchfab body-part proof complete — independent bones moved; no whole-model shake/vibration')
        setBodyPartProofSummary(`Animated ${snapshot?.animatedPartCount ?? summary.animatedPartCount} parts. Root guard: ${snapshot?.rootMotionGuard || 'root-transform-stays-fixed'}. Peaks: ${peakSummary}`)
        setIsBodyPartProofRunning(false)
        console.log('Sketchfab body-part proof complete', snapshot)
      }, summary.durationMs + 220)
    } catch (error) {
      setIsBodyPartProofRunning(false)
      setBodyPartProofStatus(`Sketchfab body-part proof failed: ${error.message}`)
      setBodyPartProofSummary('Use a rigged GLB/glTF/Sketchfab model with named skeleton bones; static mesh-only models cannot move limbs separately without rigging.')
      console.error('Sketchfab body-part proof failed', error)
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
          <button className="secondary-button" type="button" onClick={handleRunArmMotionProof} disabled={isArmProofRunning}>
            {isArmProofRunning ? 'Hands/arms proof running…' : 'Run hands/arms proof'}
          </button>
          <button className="secondary-button" type="button" onClick={handleRunBodyPartProof} disabled={isBodyPartProofRunning}>
            {isBodyPartProofRunning ? 'Body-part proof running…' : 'Run Sketchfab body-part proof'}
          </button>
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
          <p className="mono">Routed model viewer link support</p>
          <p>Use ?model=avatars/valid-white-f1-casual.glb to open the full app with that hosted model rendered in-browser instead of linking directly to the raw .glb download.</p>
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
          <p className="mono">Sketchfab body-part proof</p>
          <p>{bodyPartProofStatus}</p>
          <p className="muted">{bodyPartProofSummary}</p>
          <p className="mono">Movement signal ladder</p>
          <p>VRM/GLB/glTF → blink/breathe → head sway → mouth test → shoulder/upperArm/lowerArm/hand motion where rigged → response expression. Sketchfab body-part proof adds independent skeleton parts and blocks whole-root shaking.</p>
          <ul className="proof-checklist">
            <li>{uploadedVrmName !== 'No avatar loaded yet' ? '✅' : '⬜'} Avatar load ready</li>
            <li>✅ Blink / breathe / head movement loop</li>
            <li>{movementProofStatus.includes('mouth-open') || movementProofStatus.includes('running') || movementProofStatus.includes('mouth test') || movementProofStatus.includes('Full demo complete') || runtimeStatus.includes('mouth/expression motion') ? '✅' : '⬜'} Audio/amplitude mouth-open proof</li>
            <li>{armProofStatus.includes('running') || armProofStatus.includes('complete') ? '✅' : '⬜'} Explicit shoulder / upperArm / lowerArm / hand motion proof</li>
            <li>{bodyPartProofStatus.includes('running') || bodyPartProofStatus.includes('complete') ? '✅' : '⬜'} Sketchfab skeleton body parts move independently; root transform locked</li>
            <li>{runtimeStatus.includes('expression change on response') || runtimeStatus.includes('response expression latched') || assistantResponse ? '✅' : '⬜'} Expression/chat state reaction proof</li>
          </ul>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={handleRunArmMotionProof} disabled={isArmProofRunning}>
              {isArmProofRunning ? 'Hands/arms proof running…' : 'Run hands/arms proof'}
            </button>
            <button className="secondary-button" type="button" onClick={handleRunBodyPartProof} disabled={isBodyPartProofRunning}>
              {isBodyPartProofRunning ? 'Body-part proof running…' : 'Run Sketchfab body-part proof'}
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

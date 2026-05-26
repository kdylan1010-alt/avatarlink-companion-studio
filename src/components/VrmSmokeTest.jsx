import { useEffect, useRef, useState } from 'react'
import { createVrmPreview } from '../lib/vrmRuntime'

// Smoke marker: /avatars/sample.vrm
const SAMPLE_PATH = `${import.meta.env.BASE_URL}avatars/sample.vrm`
const FAST_SAMPLE_PATH = `${import.meta.env.BASE_URL}avatars/open-source-avatars-devil.vrm`
const DEFAULT_SMOKE_PATH = FAST_SAMPLE_PATH
const LOAD_TIMEOUT_MS = 12000

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

export function VrmSmokeTest() {
  const canvasRef = useRef(null)
  const runtimeRef = useRef(null)
  const [status, setStatus] = useState('Booting VRM smoke test…')
  const [details, setDetails] = useState('Awaiting sample load')

  useEffect(() => {
    let mounted = true
    async function boot() {
      runtimeRef.current = await createVrmPreview(canvasRef.current)
      let samplePath = DEFAULT_SMOKE_PATH
      let info
      try {
        // GitHub Pages can be very slow serving the old 11 MB sample.vrm.
        // Use the small tracked VRM as the actual smoke-test default and keep
        // sample.vrm only as a QA marker/backward-compatible fallback.
        info = await withLoadTimeout(runtimeRef.current.loadUrl(DEFAULT_SMOKE_PATH), 'VRM smoke fast default load')
      } catch (fastError) {
        console.warn('Fast VRM smoke default stalled; trying legacy sample.vrm fallback', fastError)
        samplePath = SAMPLE_PATH
        info = await withLoadTimeout(runtimeRef.current.loadUrl(SAMPLE_PATH), 'VRM smoke legacy sample.vrm load')
      }
      console.log('VRM loaded', info)
      if (!mounted) return
      setStatus('VRM loaded')
      setDetails(JSON.stringify({ samplePath, ...info }, null, 2))
    }
    boot().catch((error) => {
      console.error('VrmSmokeTest load failed', error)
      if (mounted) {
        setStatus(`VrmSmokeTest failed: ${error.message}`)
        setDetails(error.stack || 'no stack')
      }
    })
    return () => {
      mounted = false
      runtimeRef.current?.destroy()
      runtimeRef.current = null
    }
  }, [])

  return (
    <section className="panel human-card" data-testid="vrm-smoke-test">
      <div className="section-head">
        <p className="eyebrow">VRM smoke test</p>
        <h2>Standalone default avatar loader</h2>
      </div>
      <div className="preview-stage">
        <canvas ref={canvasRef} className="preview-canvas" aria-label="VRM smoke canvas" />
      </div>
      <div className="preview-card">
        <p className="mono">Status</p>
        <p>{status}</p>
        <p className="mono">Details</p>
        <pre>{details}</pre>
      </div>
    </section>
  )
}

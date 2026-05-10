import { useEffect, useRef, useState } from 'react'
import { createVrmPreview } from '../lib/vrmRuntime'

const SAMPLE_PATH = '/avatars/sample.vrm'

export function VrmSmokeTest() {
  const canvasRef = useRef(null)
  const runtimeRef = useRef(null)
  const [status, setStatus] = useState('Booting VRM smoke test…')
  const [details, setDetails] = useState('Awaiting sample load')

  useEffect(() => {
    let mounted = true
    async function boot() {
      runtimeRef.current = await createVrmPreview(canvasRef.current)
      const info = await runtimeRef.current.loadUrl(SAMPLE_PATH)
      console.log('VRM loaded', info)
      if (!mounted) return
      setStatus('VRM loaded')
      setDetails(JSON.stringify({ samplePath: SAMPLE_PATH, ...info }, null, 2))
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

export function createLiveTtsIngestState(bridge) {
  const frameCount = bridge?.frameCount ?? 0
  const source = bridge?.source ?? 'missing_bridge'
  return {
    source,
    frameCount,
    ready: frameCount > 0,
    mode: frameCount > 0 ? 'stub_live_ingest_ready' : 'stub_live_ingest_empty',
  }
}

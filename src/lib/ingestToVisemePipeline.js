export function buildIngestToVisemePipeline(ingestState, bridge, analysis) {
  return {
    ingestMode: ingestState?.mode ?? 'missing_ingest',
    bridgeSource: bridge?.source ?? 'missing_bridge',
    frameCount: bridge?.frameCount ?? 0,
    analysisReady: Boolean(analysis && analysis.frames >= 0),
    recommendedMouthOpen: analysis?.recommendedMouthOpen ?? 0,
    status: bridge?.frameCount ? 'stub_pipeline_ready' : 'stub_pipeline_empty',
  }
}

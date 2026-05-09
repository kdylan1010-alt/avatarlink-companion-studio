export function createTtsFrameBridge(samples = [], frameMs = 33) {
  const safeSamples = samples.map((sample, index) => ({
    timeMs: index * frameMs,
    amplitude: Number(Math.min(1, Math.max(0, sample)).toFixed(2)),
  }))

  return {
    frameMs,
    frames: safeSamples,
    frameCount: safeSamples.length,
    source: safeSamples.length ? 'stub_tts_frames' : 'empty_tts_frames',
  }
}

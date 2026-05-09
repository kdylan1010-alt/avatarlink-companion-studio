export function buildVisemeTimeline(samples = [], frameMs = 33) {
  return samples.map((amplitude, index) => ({
    timeMs: index * frameMs,
    mouthOpen: Math.min(1, Math.max(0, amplitude)),
  }))
}

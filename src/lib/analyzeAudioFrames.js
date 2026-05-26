export function analyzeAudioFrames(samples = []) {
  if (!samples.length) {
    return { peak: 0, average: 0, frames: 0, recommendedMouthOpen: 0 }
  }

  const peak = Math.max(...samples)
  const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  return {
    peak: Number(peak.toFixed(2)),
    average: Number(average.toFixed(2)),
    frames: samples.length,
    recommendedMouthOpen: Number(Math.min(1, average * 1.35).toFixed(2)),
  }
}

export function normalizeAmplitude(samples = []) {
  if (!samples.length) return 0
  const meanSquare = samples.reduce((sum, value) => sum + value * value, 0) / samples.length
  return Math.min(1, Math.sqrt(meanSquare) * 1.6)
}

export function amplitudeToMouthOpen(amplitude) {
  return Math.min(1, Math.max(0, amplitude * 1.15))
}

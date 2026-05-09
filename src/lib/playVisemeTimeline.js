export function playVisemeTimeline(timeline = [], onFrame, frameMs = 33) {
  if (!timeline.length) return () => {}

  let index = 0
  const timer = setInterval(() => {
    const frame = timeline[index]
    if (frame) onFrame(frame)
    index += 1
    if (index >= timeline.length) clearInterval(timer)
  }, frameMs)

  return () => clearInterval(timer)
}

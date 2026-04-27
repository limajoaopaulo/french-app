import { TIME_THRESHOLDS } from "@/lib/constants"

export type SpeedTag = "fast" | "normal" | "slow"

export function getTimeThresholds(q: { cue: string; options: string[] }): { fastMax: number; slowMin: number } {
  const words = countWords(q.cue) + q.options.reduce((s, o) => s + countWords(o), 0)
  const readSeconds = words / TIME_THRESHOLDS.wordsPerSecondBase / 2
  const fastMax = Math.max(TIME_THRESHOLDS.fastFloorSeconds, Math.floor(readSeconds))
  const slowMin = Math.min(
    TIME_THRESHOLDS.slowMaxSeconds,
    Math.max(TIME_THRESHOLDS.slowMinSeconds, Math.floor(readSeconds * TIME_THRESHOLDS.slowMultiplier)),
  )
  return { fastMax, slowMin }
}

export function speedTag(responseMs: number, q: { cue: string; options: string[] }): SpeedTag {
  const { fastMax, slowMin } = getTimeThresholds(q)
  const sec = responseMs / 1000
  if (sec <= fastMax) return "fast"
  if (sec >= slowMin) return "slow"
  return "normal"
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

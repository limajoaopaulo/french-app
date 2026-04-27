import { LEVEL_POINTS, SPEED_MULTIPLIER, RANK_TIERS } from "@/lib/constants"
import type { SpeedTag } from "@/lib/time"

// Points reward consolidation: stability gained (in days) weighted by the
// CEFR level of the question and the speed of recall. Wrong answers earn 0 —
// FSRS already punishes via the stability reset to ~1d that "Again" triggers.
export function pointsForAnswer(args: {
  levelAtServe: number
  stabilityBefore: number
  stabilityAfter: number
  correct: boolean
  speedTag: SpeedTag
}): number {
  if (!args.correct) return 0
  const gain = Math.max(0, args.stabilityAfter - args.stabilityBefore)
  const weight = LEVEL_POINTS[args.levelAtServe] ?? 0
  const speed = SPEED_MULTIPLIER[args.speedTag] ?? 1
  return gain * weight * speed
}

export function pointsPerQuestion(totalPoints: number, questionsSeen: number): number {
  return questionsSeen > 0 ? totalPoints / questionsSeen : 0
}

export function rankTier(ppq: number) {
  return RANK_TIERS.find((t) => ppq >= t.minPpq) ?? RANK_TIERS[RANK_TIERS.length - 1]
}

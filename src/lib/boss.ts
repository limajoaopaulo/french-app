import { BOSSES } from "@/lib/constants"

export function buildBossComposition(
  level: number,
  rng: () => number = Math.random,
): number[] {
  const blocks = BOSSES.composition[String(level)]
  if (!blocks) throw new Error(`No boss composition for level ${level}`)
  const queue: number[] = []
  for (const block of blocks) {
    for (let i = 0; i < block.count; i++) queue.push(block.level)
  }
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[queue[i], queue[j]] = [queue[j], queue[i]]
  }
  return queue
}

export function bossMedalFromMisses(missCount: number): {
  tier: string
  label: string
  color: string
  rank: number
} | null {
  if (missCount > BOSSES.maxMisses) return null
  const meta = BOSSES.medalByMisses[String(missCount)]
  return meta ?? null
}

export function isBossDefeat(missCount: number): boolean {
  return missCount > BOSSES.maxMisses
}

export function medalByTier(tier: string): {
  tier: string
  label: string
  color: string
  rank: number
} | null {
  for (const meta of Object.values(BOSSES.medalByMisses)) {
    if (meta.tier === tier) return meta
  }
  return null
}

import raw from "@/data/constants.json"

export const LEVEL_LABELS = raw.levels.labels as readonly string[]
export const LEVEL_POINTS = raw.levels.base_points_by_level as readonly number[]

export const STABILITY_THRESHOLDS_DAYS = raw.levels.stability_thresholds_days as Record<string, number>
export const CARDS_PER_LEVEL_THRESHOLD = raw.levels.cards_per_level_threshold

export const SPEED_MULTIPLIER = raw.scoring_rules.speed_multiplier as Record<"fast" | "normal" | "slow", number>

export const FSRS_TARGET_RETENTION = raw.fsrs.target_retention

export const SERVE_DISTRIBUTION = {
  atCurrent: raw.serve_level_distribution.at_current,
  oneAbove: raw.serve_level_distribution.one_above,
  oneBelow: raw.serve_level_distribution.one_below,
} as const

export interface RankTier {
  name: string
  minPpq: number
  color: string
}

export const RANK_TIERS: readonly RankTier[] = [
  { name: "diamond", minPpq: raw.rank_tiers.diamond.min_ppq, color: raw.rank_tiers.diamond.color },
  { name: "platinum", minPpq: raw.rank_tiers.platinum.min_ppq, color: raw.rank_tiers.platinum.color },
  { name: "gold", minPpq: raw.rank_tiers.gold.min_ppq, color: raw.rank_tiers.gold.color },
  { name: "silver", minPpq: raw.rank_tiers.silver.min_ppq, color: raw.rank_tiers.silver.color },
  { name: "bronze", minPpq: raw.rank_tiers.bronze.min_ppq, color: raw.rank_tiers.bronze.color },
] as const

export interface UserTier {
  name: string
  min: number
  color: string
}

// Lifetime XP tiers — cumulative totalPoints across all completed sessions.
// Sorted ascending; userTier() walks from the top down.
export const USER_TIERS: readonly UserTier[] = (
  raw.user_tiers as ReadonlyArray<{ name: string; min: number; color: string }>
).map((t) => ({ name: t.name, min: t.min, color: t.color }))

export const TIME_THRESHOLDS = {
  wordsPerSecondBase: raw.time_thresholds.words_per_second_base,
  fastFloorSeconds: raw.time_thresholds.fast_floor_seconds,
  slowMinSeconds: raw.time_thresholds.slow_min_seconds,
  slowMaxSeconds: raw.time_thresholds.slow_max_seconds,
  slowMultiplier: raw.time_thresholds.slow_multiplier,
} as const

export const DRILL_LENGTHS = {
  personalisedOptions: raw.drill_lengths.personalised_options as readonly number[],
  defaultLength: raw.drill_lengths.default_length,
  reviewDefaultLength: raw.drill_lengths.review_default_length,
} as const

export const DIFFICULTIES = {
  homeCardMeanR: raw.difficulties_thresholds.home_card_meanR,
  homeCardMinCards: raw.difficulties_thresholds.home_card_min_cards,
  sessionCalloutTopK: raw.difficulties_thresholds.session_callout_top_k,
} as const

export const SAMPLING = {
  lowRBoostScale: raw.sampling.low_r_boost_scale,
  dueBoost: raw.sampling.due_boost,
  coldCardBonus: raw.sampling.cold_card_bonus,
  patternWeaknessBonusMax: raw.sampling.pattern_weakness_bonus_max,
  weakPatternMultiplier: raw.sampling.weak_pattern_multiplier,
  coldPatternBoost: raw.sampling.cold_pattern_boost,
  patternStalenessDays: raw.sampling.pattern_staleness_days,
  samePatternDampBase: raw.sampling.same_pattern_damp_base,
  weightFloor: raw.sampling.weight_floor,
} as const

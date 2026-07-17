import { prisma } from "@/lib/db"
import { DIFFICULTIES, FSRS_TARGET_RETENTION } from "@/lib/constants"
import { rankTier, userTier, type UserTierInfo } from "@/lib/points"
import { type LanguageCode } from "@/lib/taxonomy"
import {
  loadTagAggregates,
  overallLevel,
  pickPersonalisedTargets,
  type PersonalisedTargets,
  type TagAggregate,
} from "@/lib/progression"

export interface RecentSession {
  id: number
  mode: string
  questionsSeen: number
  correctCount: number
  ppq: number
  rankTier: { name: string; color: string }
  startedAt: Date
}

export interface RecurrentDifficulty {
  facet: string
  tag: string
  label: string
  meanR: number
  cardCount: number
}

export interface HomeData {
  recentSessions: RecentSession[]
  dueReviewCount: number
  personalisedPreview: PersonalisedTargets | null
  tagAggregates: TagAggregate[]
  overallLevel: number
  recurrentDifficulties: RecurrentDifficulty[]
  lifetimeXp: number
  tier: UserTierInfo
}

export async function loadHomeData(args: {
  userId: number
  languageId: number
  languageCode: LanguageCode
}): Promise<HomeData> {
  const now = new Date()

  const [sessions, dueCount, tagAggregates, xpAggregate] = await Promise.all([
    prisma.session.findMany({
      where: { userId: args.userId, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
    prisma.questionState.count({
      where: {
        userId: args.userId,
        dueAt: { lte: now },
        question: { languageId: args.languageId },
      },
    }),
    loadTagAggregates(args.userId, args.languageId, args.languageCode),
    prisma.session.aggregate({
      where: { userId: args.userId, endedAt: { not: null } },
      _sum: { totalPoints: true },
    }),
  ])

  const lifetimeXp = xpAggregate._sum.totalPoints ?? 0
  const tier = userTier(lifetimeXp)

  const recentSessions: RecentSession[] = sessions.map((s) => ({
    id: s.id,
    mode: s.mode,
    questionsSeen: s.questionsSeen,
    correctCount: s.correctCount,
    ppq: s.ppq,
    rankTier: rankTier(s.ppq),
    startedAt: s.startedAt,
  }))

  const personalisedPreview = pickPersonalisedTargets(tagAggregates)

  const recurrentDifficulties: RecurrentDifficulty[] = tagAggregates
    .filter(
      (a) =>
        a.total >= DIFFICULTIES.homeCardMinCards &&
        a.meanR < DIFFICULTIES.homeCardMeanR,
    )
    .sort((a, b) => a.meanR - b.meanR)
    .map((a) => ({
      facet: a.facet,
      tag: a.tag,
      label: a.label,
      meanR: a.meanR,
      cardCount: a.total,
    }))

  return {
    recentSessions,
    dueReviewCount: dueCount,
    personalisedPreview,
    tagAggregates,
    overallLevel: overallLevel(tagAggregates),
    recurrentDifficulties,
    lifetimeXp,
    tier,
  }
}

export { FSRS_TARGET_RETENTION }

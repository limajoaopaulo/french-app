import { prisma } from "@/lib/db"
import { BOSSES, DIFFICULTIES, FSRS_TARGET_RETENTION } from "@/lib/constants"
import { rankTier, userTier, type UserTierInfo } from "@/lib/points"
import { getDomains, type Domain, type LanguageCode } from "@/lib/taxonomy"
import {
  computeBossProgress,
  computeUnlockedBossLevels,
  loadSubAggregates,
  pickPersonalisedTargets,
  type BossProgress,
  type PersonalisedTargets,
  type SubAggregate,
} from "@/lib/progression"
import { patternMastery, type CardForLevel } from "@/lib/levels"

export interface RecentSession {
  id: number
  mode: string
  domainFilter: string | null
  questionsSeen: number
  correctCount: number
  ppq: number
  rankTier: { name: string; color: string }
  startedAt: Date
  bossDomain: string | null
  bossLevel: number | null
  bossMedal: string | null
}

export interface BossCard {
  domain: Domain
  level: number
  unlocked: boolean
  progress: BossProgress
}

export interface RecurrentDifficulty {
  pattern: string
  meanR: number
  cardCount: number
}

export interface HomeData {
  recentSessions: RecentSession[]
  dueReviewCount: number
  bosses: BossCard[]
  personalisedPreview: PersonalisedTargets | null
  subAggregates: SubAggregate[]
  recurrentDifficulties: RecurrentDifficulty[]
  lifetimeXp: number
  tier: UserTierInfo
}

export async function loadHomeData(args: {
  userId: number
  languageId: number
  languageCode: LanguageCode
  domainFilter?: Domain
}): Promise<HomeData> {
  const now = new Date()

  const sessionWhere = {
    userId: args.userId,
    endedAt: { not: null as Date | null },
    ...(args.domainFilter
      ? {
          OR: [
            { domainFilter: args.domainFilter },
            { bossDomain: args.domainFilter },
          ],
        }
      : {}),
  }

  const [sessions, dueCount, subAggregates, statesWithQuestion, xpAggregate] =
    await Promise.all([
      prisma.session.findMany({
        where: sessionWhere,
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
      loadSubAggregates(args.userId, args.languageId),
      prisma.questionState.findMany({
        where: { userId: args.userId, question: { languageId: args.languageId } },
        include: {
          question: { select: { domain: true, sub: true, pattern: true, level: true } },
        },
      }),
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
    domainFilter: s.domainFilter,
    questionsSeen: s.questionsSeen,
    correctCount: s.correctCount,
    ppq: s.ppq,
    rankTier: rankTier(s.ppq),
    startedAt: s.startedAt,
    bossDomain: s.bossDomain,
    bossLevel: s.bossLevel,
    bossMedal: s.bossMedal,
  }))

  const filteredAggregates = args.domainFilter
    ? subAggregates.filter((a) => a.domain === args.domainFilter)
    : subAggregates

  const domains = getDomains(args.languageCode)
  const bossDomains = args.domainFilter
    ? [args.domainFilter]
    : (Object.keys(domains) as Domain[])
  const bosses: BossCard[] = []
  for (const domainKey of bossDomains) {
    const unlockedLevels = new Set(
      computeUnlockedBossLevels(subAggregates, domainKey),
    )
    for (const level of BOSSES.levels) {
      bosses.push({
        domain: domainKey,
        level,
        unlocked: unlockedLevels.has(level),
        progress: computeBossProgress(subAggregates, domainKey, level),
      })
    }
  }

  const personalisedPreview = await pickPersonalisedTargets({
    userId: args.userId,
    languageId: args.languageId,
    languageCode: args.languageCode,
    subAggregates,
    domainFilter: args.domainFilter,
  })

  const activeKeys = new Set(
    subAggregates.filter((s) => s.isActive).map((s) => `${s.domain}::${s.sub}`),
  )
  const cardsForPattern: Array<CardForLevel & { pattern: string }> =
    statesWithQuestion
      .filter((s) =>
        activeKeys.has(`${s.question.domain}::${s.question.sub}`) &&
        (!args.domainFilter || s.question.domain === args.domainFilter),
      )
      .map((s) => ({
        level: s.question.level,
        stability: s.stability,
        difficulty: s.difficulty,
        state: s.state,
        scheduledDays: s.scheduledDays,
        learningSteps: s.learningSteps,
        reps: s.reps,
        lapses: s.lapses,
        lastReview: s.lastReview,
        dueAt: s.dueAt,
        pattern: s.question.pattern,
      }))
  const mastery = patternMastery(cardsForPattern, now)
  const recurrentDifficulties: RecurrentDifficulty[] = mastery
    .filter(
      (m) =>
        m.cardCount >= DIFFICULTIES.homeCardMinCards &&
        m.meanR < DIFFICULTIES.homeCardMeanR,
    )
    .sort((a, b) => a.meanR - b.meanR)
    .map((m) => ({
      pattern: m.pattern,
      meanR: m.meanR,
      cardCount: m.cardCount,
    }))

  return {
    recentSessions,
    dueReviewCount: dueCount,
    bosses,
    personalisedPreview,
    subAggregates: filteredAggregates,
    recurrentDifficulties,
    lifetimeXp,
    tier,
  }
}

export { FSRS_TARGET_RETENTION }

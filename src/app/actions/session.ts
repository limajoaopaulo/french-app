"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { prisma } from "@/lib/db"
import {
  StartBossSchema,
  StartPersonalisedSchema,
  SubmitAnswerSchema,
} from "@/lib/schemas"
import { pickBossQuestion, pickNextQuestion } from "@/lib/serve"
import { shuffleOptions } from "@/lib/shuffle"
import { applyOutcome } from "@/lib/fsrs"
import {
  applyBossDefeatSkillLoss,
  computeUnlockedBossLevels,
  loadSubAggregates,
  pickPersonalisedTargets,
  snapshotSubLevels,
} from "@/lib/progression"
import { pointsForAnswer, pointsPerQuestion } from "@/lib/points"
import { speedTag } from "@/lib/time"
import {
  bossMedalFromMisses,
  buildBossComposition,
  isBossDefeat,
} from "@/lib/boss"
import { getDomains, type Domain } from "@/lib/taxonomy"
import { requireUser } from "@/lib/auth"

export interface ServedQuestionDTO {
  questionId: number
  domain: string
  sub: string
  level: number
  pattern: string
  cueType: string
  cue: string
  options: string[]
  correctIndex: number
  explanation: string
  levelAtServe: number
  index: number
  total: number
  encounters: number
}

export async function startPersonalisedSession(
  input: unknown,
): Promise<{ sessionId: number }> {
  const user = await requireUser()
  const parsed = StartPersonalisedSchema.parse(input)

  let targetSubs = parsed.targetSubs
  let levelRange = parsed.levelRange

  if (!targetSubs || !levelRange) {
    const subAggregates = await loadSubAggregates(user.id, user.languageId)
    const auto = await pickPersonalisedTargets({
      userId: user.id,
      languageId: user.languageId,
      languageCode: user.languageCode,
      subAggregates,
      domainFilter: parsed.domainFilter,
    })
    if (auto) {
      targetSubs = targetSubs ?? auto.subs.map((s) => ({
        domain: s.domain,
        sub: s.sub,
      }))
      levelRange = levelRange ?? { min: auto.range.min, max: auto.range.max }
    }
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      mode: "personalised",
      domainFilter: parsed.domainFilter ?? null,
      plannedLength: parsed.length,
      targetSubs: targetSubs ? JSON.stringify(targetSubs) : null,
      levelMin: levelRange?.min ?? null,
      levelMax: levelRange?.max ?? null,
      subLevelsBefore: JSON.stringify({}),
    },
  })
  // Compute the "before" snapshot after the response — the client only needs
  // sessionId to redirect. The snapshot is read on the end-of-session page,
  // many seconds (or minutes) later, by which point this has long completed.
  after(async () => {
    const snapshot = await snapshotSubLevels(user.id, user.languageId)
    await prisma.session.update({
      where: { id: session.id },
      data: { subLevelsBefore: JSON.stringify(snapshot) },
    })
  })
  return { sessionId: session.id }
}

export async function startBossSession(
  input: unknown,
): Promise<{ sessionId: number }> {
  const user = await requireUser()
  const parsed = StartBossSchema.parse(input)

  const subAggregates = await loadSubAggregates(user.id, user.languageId)
  const unlocked = new Set(computeUnlockedBossLevels(subAggregates, parsed.domain))
  if (!unlocked.has(parsed.level)) {
    throw new Error(`Boss ${parsed.domain} level ${parsed.level} is locked`)
  }

  const queue = buildBossComposition(parsed.level)
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      mode: "boss",
      domainFilter: parsed.domain,
      plannedLength: queue.length,
      bossDomain: parsed.domain,
      bossLevel: parsed.level,
      bossQueue: JSON.stringify(queue),
      subLevelsBefore: JSON.stringify({}),
    },
  })
  after(async () => {
    const snapshot = await snapshotSubLevels(user.id, user.languageId)
    await prisma.session.update({
      where: { id: session.id },
      data: { subLevelsBefore: JSON.stringify(snapshot) },
    })
  })
  return { sessionId: session.id }
}

export async function serveNext(sessionId: number): Promise<ServedQuestionDTO | { done: true }> {
  const user = await requireUser()
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId: user.id } })
  if (!session) throw new Error(`Session ${sessionId} not found`)
  if (session.endedAt) return { done: true }
  if (session.questionsSeen >= session.plannedLength) return { done: true }

  const servedReviews = await prisma.review.findMany({
    where: { userId: user.id, sessionId },
    include: { question: { select: { pattern: true } } },
  })
  const servedIds = servedReviews.map((r) => r.questionId)

  if (session.mode === "boss") {
    if (!session.bossDomain || !session.bossQueue) return { done: true }
    const queue = safeParseIntArray(session.bossQueue)
    const pickedBoss = await pickBossQuestion({
      userId: user.id,
      languageId: user.languageId,
      bossDomain: session.bossDomain,
      queue,
      servedIds,
    })
    if (!pickedBoss) return { done: true }

    await prisma.session.update({
      where: { id: session.id },
      data: { bossQueue: JSON.stringify(pickedBoss.remainingQueue) },
    })

    const shuffledBoss = shuffleOptions({
      options: pickedBoss.question.options,
      correctIndex: pickedBoss.question.correctIndex,
    })
    return {
      questionId: pickedBoss.question.id,
      domain: pickedBoss.question.domain,
      sub: pickedBoss.question.sub,
      level: pickedBoss.question.level,
      pattern: pickedBoss.question.pattern,
      cueType: pickedBoss.question.cueType,
      cue: pickedBoss.question.cue,
      options: shuffledBoss.options,
      correctIndex: shuffledBoss.correctIndex,
      explanation: pickedBoss.question.explanation,
      levelAtServe: pickedBoss.levelAtServe,
      index: session.questionsSeen,
      total: session.plannedLength,
      encounters: pickedBoss.question.encounters,
    }
  }

  const targetSubs = session.targetSubs
    ? (JSON.parse(session.targetSubs) as Array<{ domain: string; sub: string }>)
    : undefined
  const levelRange =
    session.levelMin !== null && session.levelMax !== null
      ? { min: session.levelMin, max: session.levelMax }
      : undefined

  const picked = await pickNextQuestion({
    userId: user.id,
    languageId: user.languageId,
    sessionId,
    domainFilter:
      (session.domainFilter as "grammar" | "vocabulary" | null) ?? undefined,
    servedIds,
    targetSubs,
    levelRange,
    prefetchedReviews: servedReviews,
  })
  if (!picked) return { done: true }

  const shuffled = shuffleOptions({
    options: picked.question.options,
    correctIndex: picked.question.correctIndex,
  })

  return {
    questionId: picked.question.id,
    domain: picked.question.domain,
    sub: picked.question.sub,
    level: picked.question.level,
    pattern: picked.question.pattern,
    cueType: picked.question.cueType,
    cue: picked.question.cue,
    options: shuffled.options,
    correctIndex: shuffled.correctIndex,
    explanation: picked.question.explanation,
    levelAtServe: picked.levelAtServe,
    index: session.questionsSeen,
    total: session.plannedLength,
    encounters: picked.question.encounters,
  }
}

function safeParseIntArray(s: string): number[] {
  try {
    const v = JSON.parse(s)
    if (Array.isArray(v)) return v.filter((x) => Number.isFinite(x))
  } catch {}
  return []
}

export async function submitAnswer(input: unknown): Promise<{
  correct: boolean
  remaining: number
}> {
  const user = await requireUser()
  const parsed = SubmitAnswerSchema.parse(input)

  const [question, session] = await Promise.all([
    prisma.question.findFirst({
      where: { id: parsed.questionId, languageId: user.languageId },
    }),
    prisma.session.findFirst({ where: { id: parsed.sessionId, userId: user.id } }),
  ])
  if (!question) throw new Error(`Question ${parsed.questionId} not found`)
  if (!session) throw new Error(`Session ${parsed.sessionId} not found`)

  const selfGrade = parsed.selfGrade ?? null
  // Anki mode: chosenIndex is -1, correctness derived from self-grade.
  // Multi-choice mode: correctness from chosen vs displayed correct.
  const correct = selfGrade
    ? selfGrade !== "again"
    : parsed.chosenIndex === parsed.displayedCorrectIndex

  const optionsArr = JSON.parse(question.options) as string[]
  const tag = speedTag(parsed.responseMs, { cue: question.cue, options: optionsArr })

  const fsrsResult = await applyOutcome({
    userId: user.id,
    questionId: question.id,
    signal: { correct, speedTag: tag, selfGrade },
  })

  const points = pointsForAnswer({
    levelAtServe: parsed.levelAtServe,
    stabilityBefore: fsrsResult.stabilityBefore,
    stabilityAfter: fsrsResult.stabilityAfter,
    correct,
    speedTag: tag,
  })

  await prisma.review.create({
    data: {
      userId: user.id,
      questionId: question.id,
      sessionId: session.id,
      correct,
      selfGrade,
      responseMs: parsed.responseMs,
      speedTag: tag,
      pointsEarned: points,
      levelAtServe: parsed.levelAtServe,
    },
  })

  await prisma.patternStats.upsert({
    where: {
      userId_domain_sub_pattern: {
        userId: user.id,
        domain: question.domain,
        sub: question.sub,
        pattern: question.pattern,
      },
    },
    update: { lastSeenAt: new Date() },
    create: {
      userId: user.id,
      domain: question.domain,
      sub: question.sub,
      pattern: question.pattern,
      lastSeenAt: new Date(),
    },
  })

  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      questionsSeen: session.questionsSeen + 1,
      correctCount: session.correctCount + (correct ? 1 : 0),
      missCount: session.missCount + (correct ? 0 : 1),
      totalPoints: session.totalPoints + points,
    },
  })

  if (
    updatedSession.mode === "boss" &&
    updatedSession.bossDomain &&
    updatedSession.bossLevel !== null &&
    isBossDefeat(updatedSession.missCount)
  ) {
    await applyBossDefeatSkillLoss({
      userId: user.id,
      languageId: user.languageId,
      domain: updatedSession.bossDomain,
      bossLevel: updatedSession.bossLevel,
    })
    await prisma.session.update({
      where: { id: updatedSession.id },
      data: {
        endedAt: new Date(),
        endReason: "boss_defeat",
        ppq: pointsPerQuestion(
          updatedSession.totalPoints,
          updatedSession.questionsSeen,
        ),
      },
    })
    revalidatePath("/")
  }

  return {
    correct,
    remaining: Math.max(0, updatedSession.plannedLength - updatedSession.questionsSeen),
  }
}

export async function endSession(sessionId: number): Promise<void> {
  const user = await requireUser()
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId: user.id } })
  if (!session) throw new Error(`Session ${sessionId} not found`)
  if (session.endedAt) return

  const ppq = pointsPerQuestion(session.totalPoints, session.questionsSeen)
  const reason = session.questionsSeen >= session.plannedLength ? "completed" : "early_exit"

  const isBossVictory =
    session.mode === "boss" && session.questionsSeen >= session.plannedLength
  const medal = isBossVictory ? bossMedalFromMisses(session.missCount) : null

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      endedAt: new Date(),
      endReason: reason,
      ppq,
      bossMedal: medal?.tier ?? null,
    },
  })
  revalidatePath("/")
}

export async function loadBossDefeatDetails(sessionId: number): Promise<{
  domain: Domain
  bossLevel: number
  subs: Array<{ sub: string; label: string; level: number }>
} | null> {
  const user = await requireUser()
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId: user.id } })
  if (!session || session.endReason !== "boss_defeat") return null
  if (!session.bossDomain || session.bossLevel === null) return null

  const aggregates = await loadSubAggregates(user.id, user.languageId)
  const inDomain = aggregates.filter(
    (a) => a.domain === session.bossDomain && a.isActive,
  )

  const domains = getDomains(user.languageCode)
  const domainInfo = domains[session.bossDomain as Domain]
  return {
    domain: session.bossDomain as Domain,
    bossLevel: session.bossLevel,
    subs: inDomain.map((s) => ({
      sub: s.sub,
      label: domainInfo?.subs.find((x) => x.key === s.sub)?.label ?? s.sub,
      level: s.subLevel,
    })),
  }
}

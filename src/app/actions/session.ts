"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { StartPersonalisedSchema, SubmitAnswerSchema } from "@/lib/schemas"
import { pickNextQuestion, type TagTarget } from "@/lib/serve"
import { shuffleOptions } from "@/lib/shuffle"
import { applyOutcome } from "@/lib/fsrs"
import {
  loadTagAggregates,
  pickPersonalisedTargets,
  snapshotTagLevels,
} from "@/lib/progression"
import { pointsForAnswer, pointsPerQuestion } from "@/lib/points"
import { speedTag } from "@/lib/time"
import { requireUser } from "@/lib/auth"

export interface ServedQuestionDTO {
  questionId: number
  level: number
  format: string
  cue: string
  blankHint: string | null
  translation: string | null
  options: string[]
  correctIndex: number
  explanation: string
  tags: Array<{ facet: string; tag: string; role: string }>
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

  let targetTags = parsed.targetTags as TagTarget[] | undefined
  let levelRange = parsed.levelRange

  if (!targetTags || !levelRange) {
    const aggregates = await loadTagAggregates(
      user.id,
      user.languageId,
      user.languageCode,
    )
    const auto = pickPersonalisedTargets(aggregates)
    if (auto) {
      targetTags =
        targetTags ?? auto.targets.map((t) => ({ facet: t.facet, tag: t.tag }))
      levelRange = levelRange ?? { min: auto.range.min, max: auto.range.max }
    }
  }

  const snapshot = await snapshotTagLevels(
    user.id,
    user.languageId,
    user.languageCode,
  )
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      mode: "personalised",
      plannedLength: parsed.length,
      targetTags: targetTags ? JSON.stringify(targetTags) : null,
      levelMin: levelRange?.min ?? null,
      levelMax: levelRange?.max ?? null,
      subLevelsBefore: JSON.stringify(snapshot),
    },
  })
  return { sessionId: session.id }
}

export async function serveNext(
  sessionId: number,
): Promise<ServedQuestionDTO | { done: true }> {
  const user = await requireUser()
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId: user.id },
  })
  if (!session) throw new Error(`Session ${sessionId} not found`)
  if (session.endedAt) return { done: true }
  if (session.questionsSeen >= session.plannedLength) return { done: true }

  const servedReviews = await prisma.review.findMany({
    where: { userId: user.id, sessionId },
    select: { questionId: true },
  })
  const servedIds = servedReviews.map((r) => r.questionId)

  const targetTags = session.targetTags
    ? (JSON.parse(session.targetTags) as TagTarget[])
    : undefined
  const levelRange =
    session.levelMin !== null && session.levelMax !== null
      ? { min: session.levelMin, max: session.levelMax }
      : undefined

  const picked = await pickNextQuestion({
    userId: user.id,
    languageId: user.languageId,
    sessionId,
    servedIds,
    targetTags,
    levelRange,
  })
  if (!picked) return { done: true }

  const shuffled = shuffleOptions({
    options: picked.question.options,
    correctIndex: picked.question.correctIndex,
  })

  return {
    questionId: picked.question.id,
    level: picked.question.level,
    format: picked.question.format,
    cue: picked.question.cue,
    blankHint: picked.question.blankHint,
    translation: picked.question.translation,
    options: shuffled.options,
    correctIndex: shuffled.correctIndex,
    explanation: picked.question.explanation,
    tags: picked.question.tags,
    levelAtServe: picked.levelAtServe,
    index: session.questionsSeen,
    total: session.plannedLength,
    encounters: picked.question.encounters,
  }
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
      include: { tags: { select: { facet: true, tag: true } } },
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

  const now = new Date()
  await prisma.$transaction([
    prisma.review.create({
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
    }),
    // Fan out staleness to every tag this question carries.
    ...question.tags.map((t) =>
      prisma.tagStats.upsert({
        where: {
          userId_facet_tag: { userId: user.id, facet: t.facet, tag: t.tag },
        },
        update: { lastSeenAt: now },
        create: { userId: user.id, facet: t.facet, tag: t.tag, lastSeenAt: now },
      }),
    ),
  ])

  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      questionsSeen: session.questionsSeen + 1,
      correctCount: session.correctCount + (correct ? 1 : 0),
      missCount: session.missCount + (correct ? 0 : 1),
      totalPoints: session.totalPoints + points,
    },
  })

  return {
    correct,
    remaining: Math.max(
      0,
      updatedSession.plannedLength - updatedSession.questionsSeen,
    ),
  }
}

export async function endSession(sessionId: number): Promise<void> {
  const user = await requireUser()
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId: user.id },
  })
  if (!session) throw new Error(`Session ${sessionId} not found`)
  if (session.endedAt) return

  const ppq = pointsPerQuestion(session.totalPoints, session.questionsSeen)
  const reason =
    session.questionsSeen >= session.plannedLength ? "completed" : "early_exit"

  await prisma.session.update({
    where: { id: sessionId },
    data: { endedAt: new Date(), endReason: reason, ppq },
  })
  revalidatePath("/")
}

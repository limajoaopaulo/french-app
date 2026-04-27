import { fsrs, Rating, State, type Card, type Grade } from "ts-fsrs"
import { prisma } from "@/lib/db"
import type { SpeedTag } from "@/lib/time"

export { Rating, State }
export type { Grade }

export type SelfGrade = "again" | "hard" | "good" | "easy"

const TARGET_RETENTION = 0.9

const scheduler = fsrs({
  request_retention: TARGET_RETENTION,
  enable_fuzz: true,
})

export function getScheduler() {
  return scheduler
}

export function targetRetention(): number {
  return TARGET_RETENTION
}

export interface AnswerSignal {
  correct: boolean
  speedTag: SpeedTag
  // Anki mode: user self-grades on the flip card. When set, takes precedence
  // over the speedTag-based heuristic. correct is derived: any selfGrade
  // other than "again" implies correct=true.
  selfGrade?: SelfGrade | null
}

// Anki path (selfGrade present): direct mapping to FSRS rating.
// Multi-choice path (no selfGrade): wrong → Again; correct + fast → Easy;
// correct + slow → Hard; default correct → Good.
export function gradeFromAnswer(s: AnswerSignal): Grade {
  if (s.selfGrade) {
    switch (s.selfGrade) {
      case "again": return Rating.Again
      case "hard":  return Rating.Hard
      case "good":  return Rating.Good
      case "easy":  return Rating.Easy
    }
  }
  if (!s.correct) return Rating.Again
  if (s.speedTag === "fast") return Rating.Easy
  if (s.speedTag === "slow") return Rating.Hard
  return Rating.Good
}

// FSRS card row shape (matches QuestionState columns we persist).
export interface FSRSStateRow {
  stability: number
  difficulty: number
  state: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  lastReview: Date | null
  dueAt: Date | null
}

export function rowToCard(row: FSRSStateRow, now: Date): Card {
  return {
    due: row.dueAt ?? now,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: 0,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.lastReview ?? undefined,
  }
}

// Probability of recall right now, given the card's stability and the time
// elapsed since last review.
export function retrievability(row: FSRSStateRow, now: Date): number {
  if (row.state === State.New || !row.lastReview || row.stability <= 0) {
    return 0
  }
  return scheduler.get_retrievability(rowToCard(row, now), now, false)
}

export interface ApplyOutcomeResult {
  stabilityBefore: number
  stabilityAfter: number
  grade: Grade
  newDueAt: Date
}

export async function applyOutcome(args: {
  userId: number
  questionId: number
  signal: AnswerSignal
  now?: Date
}): Promise<ApplyOutcomeResult> {
  const now = args.now ?? new Date()
  // Upsert in case this is the user's first encounter with this question.
  const state = await prisma.questionState.upsert({
    where: { userId_questionId: { userId: args.userId, questionId: args.questionId } },
    update: {},
    create: { userId: args.userId, questionId: args.questionId },
  })

  const grade = gradeFromAnswer(args.signal)
  const card = rowToCard(state, now)
  const result = scheduler.next(card, now, grade)
  const next = result.card

  await prisma.questionState.update({
    where: { id: state.id },
    data: {
      stability: next.stability,
      difficulty: next.difficulty,
      state: next.state,
      scheduledDays: next.scheduled_days,
      learningSteps: next.learning_steps,
      reps: next.reps,
      lapses: next.lapses,
      lastReview: next.last_review ?? now,
      dueAt: next.due,
      lastSeenAt: now,
      firstServedAt: state.firstServedAt ?? now,
    },
  })

  return {
    stabilityBefore: state.stability,
    stabilityAfter: next.stability,
    grade,
    newDueAt: next.due,
  }
}

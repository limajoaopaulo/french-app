import { describe, expect, test } from "vitest"
import { gradeFromAnswer, retrievability, Rating, State, type FSRSStateRow } from "@/lib/fsrs"

describe("gradeFromAnswer", () => {
  test("wrong answer is Again, regardless of speed", () => {
    expect(gradeFromAnswer({ correct: false, speedTag: "fast" })).toBe(Rating.Again)
    expect(gradeFromAnswer({ correct: false, speedTag: "normal" })).toBe(Rating.Again)
    expect(gradeFromAnswer({ correct: false, speedTag: "slow" })).toBe(Rating.Again)
  })

  test("correct + fast is Easy", () => {
    expect(gradeFromAnswer({ correct: true, speedTag: "fast" })).toBe(Rating.Easy)
  })

  test("correct + normal is Good", () => {
    expect(gradeFromAnswer({ correct: true, speedTag: "normal" })).toBe(Rating.Good)
  })

  test("correct + slow is Hard", () => {
    expect(gradeFromAnswer({ correct: true, speedTag: "slow" })).toBe(Rating.Hard)
  })

  test("anki self-grade overrides speed-derived heuristic", () => {
    expect(gradeFromAnswer({ correct: false, speedTag: "fast", selfGrade: "again" })).toBe(Rating.Again)
    expect(gradeFromAnswer({ correct: true, speedTag: "fast", selfGrade: "hard" })).toBe(Rating.Hard)
    expect(gradeFromAnswer({ correct: true, speedTag: "slow", selfGrade: "good" })).toBe(Rating.Good)
    expect(gradeFromAnswer({ correct: true, speedTag: "normal", selfGrade: "easy" })).toBe(Rating.Easy)
  })
})

describe("retrievability", () => {
  test("returns 0 for never-reviewed cards", () => {
    const row: FSRSStateRow = {
      stability: 0,
      difficulty: 0,
      state: State.New,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      lastReview: null,
      dueAt: null,
    }
    expect(retrievability(row, new Date())).toBe(0)
  })

  test("monotonically decreases with elapsed time", () => {
    const lastReview = new Date("2026-01-01T00:00:00Z")
    const row: FSRSStateRow = {
      stability: 10,
      difficulty: 5,
      state: State.Review,
      scheduledDays: 10,
      learningSteps: 0,
      reps: 5,
      lapses: 0,
      lastReview,
      dueAt: new Date("2026-01-11T00:00:00Z"),
    }
    const day1 = retrievability(row, new Date("2026-01-02T00:00:00Z"))
    const day5 = retrievability(row, new Date("2026-01-06T00:00:00Z"))
    const day10 = retrievability(row, new Date("2026-01-11T00:00:00Z"))
    const day20 = retrievability(row, new Date("2026-01-21T00:00:00Z"))

    expect(day1).toBeGreaterThan(day5)
    expect(day5).toBeGreaterThan(day10)
    expect(day10).toBeGreaterThan(day20)
    expect(day1).toBeGreaterThan(0.9)
    expect(day20).toBeLessThan(0.9)
  })

  test("at the dueAt date, R is approximately the target retention 0.9", () => {
    const lastReview = new Date("2026-01-01T00:00:00Z")
    const row: FSRSStateRow = {
      stability: 10,
      difficulty: 5,
      state: State.Review,
      scheduledDays: 10,
      learningSteps: 0,
      reps: 5,
      lapses: 0,
      lastReview,
      dueAt: new Date("2026-01-11T00:00:00Z"),
    }
    const r = retrievability(row, new Date("2026-01-11T00:00:00Z"))
    expect(r).toBeGreaterThan(0.85)
    expect(r).toBeLessThan(0.95)
  })
})

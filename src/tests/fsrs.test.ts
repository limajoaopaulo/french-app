import { describe, expect, test } from "vitest"
import { gradeFromAnswer, retrievability, Rating, State, type FSRSStateRow } from "@/lib/fsrs"

describe("gradeFromAnswer", () => {
  test("wrong answer is Again, regardless of selfGrade", () => {
    expect(gradeFromAnswer({ correct: false, selfGrade: null })).toBe(Rating.Again)
    expect(gradeFromAnswer({ correct: false, selfGrade: "easy" })).toBe(Rating.Again)
    expect(gradeFromAnswer({ correct: false, selfGrade: "hard" })).toBe(Rating.Again)
  })

  test("correct + selfGrade='hard' is Hard", () => {
    expect(gradeFromAnswer({ correct: true, selfGrade: "hard" })).toBe(Rating.Hard)
  })

  test("correct + selfGrade='good' is Good", () => {
    expect(gradeFromAnswer({ correct: true, selfGrade: "good" })).toBe(Rating.Good)
  })

  test("correct + selfGrade='easy' is Easy", () => {
    expect(gradeFromAnswer({ correct: true, selfGrade: "easy" })).toBe(Rating.Easy)
  })

  test("correct + null selfGrade defaults to Good", () => {
    expect(gradeFromAnswer({ correct: true, selfGrade: null })).toBe(Rating.Good)
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

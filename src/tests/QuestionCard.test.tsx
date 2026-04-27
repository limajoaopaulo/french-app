import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const { submitAnswerMock } = vi.hoisted(() => ({
  submitAnswerMock: vi.fn<(input: unknown) => Promise<{ correct: boolean; remaining: number }>>(
    async () => ({ correct: true, remaining: 0 }),
  ),
}))

vi.mock("@/app/actions/session", () => ({
  submitAnswer: submitAnswerMock,
}))

import type { ServedQuestionDTO } from "@/app/actions/session"
import { QuestionCard } from "@/components/session/QuestionCard"

function makeQuestion(encounters: number, correctIndex = 0): ServedQuestionDTO {
  return {
    questionId: 1,
    domain: "grammar",
    sub: "present_conjugation",
    level: 2,
    pattern: "present-er-regular",
    cueType: "gap_fr",
    cue: "Nous ___ français.",
    options: ["parlons", "parlez", "parlent", "parles"],
    correctIndex,
    explanation: "1st-person plural -er verbs end in -ons.",
    levelAtServe: 2,
    index: 0,
    total: 10,
    encounters,
  }
}

describe("QuestionCard", () => {
  it("shows options immediately on every encounter (no confidence gate)", () => {
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(0)}
        onAdvance={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: /parlons/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /parlez/ })).toBeInTheDocument()
    expect(screen.getByText("New")).toBeInTheDocument()
  })

  it("on a repeat encounter still shows options first (no confidence buttons)", () => {
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(3)}
        onAdvance={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: /parlons/ })).toBeInTheDocument()
    expect(screen.queryByText("Hard")).not.toBeInTheDocument()
    expect(screen.queryByText("New")).not.toBeInTheDocument()
  })

  it("shows the self-grade flip card after picking the correct option", async () => {
    submitAnswerMock.mockClear()
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(0, 0)}
        onAdvance={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /parlons/ }))
    expect(await screen.findByText("Hard")).toBeInTheDocument()
    expect(screen.getByText("Good")).toBeInTheDocument()
    expect(screen.getByText("Easy")).toBeInTheDocument()
    // submitAnswer not yet called — waiting for self-grade.
    expect(submitAnswerMock).not.toHaveBeenCalled()
  })

  it("submits with the chosen self-grade after the flip card", async () => {
    submitAnswerMock.mockClear()
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(0, 0)}
        onAdvance={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /parlons/ }))
    fireEvent.click(await screen.findByText("Good"))
    expect(submitAnswerMock).toHaveBeenCalledTimes(1)
    const arg = submitAnswerMock.mock.calls[0][0] as { selfGrade: string | null }
    expect(arg.selfGrade).toBe("good")
  })

  it("on a wrong pick, skips the flip card and submits with selfGrade=null", async () => {
    submitAnswerMock.mockClear()
    submitAnswerMock.mockImplementationOnce(async () => ({
      correct: false,
      remaining: 0,
    }))
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(0, 0)}
        onAdvance={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /parlez/ }))
    // No flip card — flow advances directly to explanation
    expect(await screen.findByText("Incorrect")).toBeInTheDocument()
    expect(screen.queryByText("Hard")).not.toBeInTheDocument()
    expect(submitAnswerMock).toHaveBeenCalledTimes(1)
    const arg = submitAnswerMock.mock.calls[0][0] as { selfGrade: string | null }
    expect(arg.selfGrade).toBeNull()
  })
})

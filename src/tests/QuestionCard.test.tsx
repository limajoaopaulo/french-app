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
  it("shows options immediately on every encounter (no confidence/self-grade gate)", () => {
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(0)}
        onAdvance={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: /parlons/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /parlez/ })).toBeInTheDocument()
    expect(screen.queryByText("Hard")).not.toBeInTheDocument()
    expect(screen.queryByText("Easy")).not.toBeInTheDocument()
  })

  it("on a correct pick, submits immediately and shows the explanation", async () => {
    submitAnswerMock.mockClear()
    submitAnswerMock.mockImplementationOnce(async () => ({ correct: true, remaining: 0 }))
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(0, 0)}
        onAdvance={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /parlons/ }))
    expect(await screen.findByText("Correct")).toBeInTheDocument()
    expect(submitAnswerMock).toHaveBeenCalledTimes(1)
  })

  it("on a wrong pick, submits and shows the explanation with Incorrect header", async () => {
    submitAnswerMock.mockClear()
    submitAnswerMock.mockImplementationOnce(async () => ({ correct: false, remaining: 0 }))
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(0, 0)}
        onAdvance={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /parlez/ }))
    expect(await screen.findByText("Incorrect")).toBeInTheDocument()
    expect(submitAnswerMock).toHaveBeenCalledTimes(1)
  })

  it("on the 3rd encounter, shows the anki flow (no options, just reveal + self-grade)", async () => {
    submitAnswerMock.mockClear()
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(3, 0)}
        onAdvance={() => {}}
      />,
    )
    // Cue is visible; multi-choice options are NOT
    expect(screen.getByText(/Nous ___/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /parlons/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /show answer/i })).toBeInTheDocument()
  })

  it("anki flow: reveal then self-grade submits with selfGrade and chosenIndex=-1", async () => {
    submitAnswerMock.mockClear()
    submitAnswerMock.mockImplementationOnce(async () => ({ correct: true, remaining: 0 }))
    render(
      <QuestionCard
        sessionId={1}
        question={makeQuestion(5, 0)}
        onAdvance={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }))
    fireEvent.click(await screen.findByRole("button", { name: /^good$/i }))
    expect(submitAnswerMock).toHaveBeenCalledTimes(1)
    const arg = submitAnswerMock.mock.calls[0][0] as {
      selfGrade: string | null
      chosenIndex: number
    }
    expect(arg.selfGrade).toBe("good")
    expect(arg.chosenIndex).toBe(-1)
  })
})

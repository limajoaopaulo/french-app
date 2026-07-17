"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ServedQuestionDTO } from "@/app/actions/session"
import { submitAnswer } from "@/app/actions/session"
import { diffOptions } from "@/lib/option-diff"
import { t } from "@/lib/i18n"

type Phase = "options" | "ankiPrompt" | "ankiReveal" | "explanation"
type SelfGrade = "again" | "good"

interface Props {
  sessionId: number
  question: ServedQuestionDTO
  onAdvance: () => void
}

const BLANK_MARKER = "___"
const ANKI_THRESHOLD = 3

function explanationDurationMs(text: string): number {
  return Math.min(7000, 2000 + 40 * text.length)
}

function splitCueAroundBlank(cue: string): { before: string; after: string } | null {
  const idx = cue.indexOf(BLANK_MARKER)
  if (idx === -1) return null
  return { before: cue.slice(0, idx), after: cue.slice(idx + BLANK_MARKER.length) }
}

export function QuestionCard({ sessionId, question, onAdvance }: Props) {
  const isFirstEncounter = question.encounters === 0
  const isAnki = question.encounters >= ANKI_THRESHOLD
  const [phase, setPhase] = useState<Phase>(isAnki ? "ankiPrompt" : "options")
  const [showTranslation, setShowTranslation] = useState(false)
  const [chosenIndex, setChosenIndex] = useState<number | null>(null)
  const [correct, setCorrect] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progressFilled, setProgressFilled] = useState(false)
  const startedAt = useRef<number>(0)
  const responseMsRef = useRef<number>(0)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const durationMs = useMemo(
    () => explanationDurationMs(question.explanation),
    [question.explanation],
  )
  const optionSegments = useMemo(
    () => diffOptions(question.options),
    [question.options],
  )
  const cueSplit = useMemo(() => splitCueAroundBlank(question.cue), [question.cue])
  const focusTags = useMemo(
    () => question.tags.filter((tag) => tag.role === "focus"),
    [question.tags],
  )
  const correctOption = question.options[question.correctIndex] ?? ""

  useEffect(() => {
    startedAt.current = performance.now()
  }, [])

  const skipExplanation = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current)
      autoAdvanceRef.current = null
    }
    onAdvance()
  }, [onAdvance])

  useEffect(() => {
    if (phase !== "explanation") return
    setProgressFilled(false)
    const raf = requestAnimationFrame(() => setProgressFilled(true))
    autoAdvanceRef.current = setTimeout(() => {
      autoAdvanceRef.current = null
      onAdvance()
    }, durationMs)
    return () => {
      cancelAnimationFrame(raf)
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current)
        autoAdvanceRef.current = null
      }
    }
  }, [phase, durationMs, onAdvance])

  const pickOption = useCallback(
    async (idx: number) => {
      if (phase !== "options" || submitting) return
      setSubmitting(true)
      responseMsRef.current = Math.round(performance.now() - startedAt.current)
      setChosenIndex(idx)
      try {
        const res = await submitAnswer({
          sessionId,
          questionId: question.questionId,
          chosenIndex: idx,
          displayedCorrectIndex: question.correctIndex,
          levelAtServe: question.levelAtServe,
          responseMs: responseMsRef.current,
        })
        setCorrect(res.correct)
        setPhase("explanation")
      } finally {
        setSubmitting(false)
      }
    },
    [phase, submitting, sessionId, question],
  )

  const reveal = useCallback(() => {
    if (phase !== "ankiPrompt") return
    responseMsRef.current = Math.round(performance.now() - startedAt.current)
    setPhase("ankiReveal")
  }, [phase])

  const pickSelfGrade = useCallback(
    async (grade: SelfGrade) => {
      if (phase !== "ankiReveal" || submitting) return
      setSubmitting(true)
      try {
        const res = await submitAnswer({
          sessionId,
          questionId: question.questionId,
          chosenIndex: -1,
          displayedCorrectIndex: question.correctIndex,
          levelAtServe: question.levelAtServe,
          responseMs: responseMsRef.current,
          selfGrade: grade,
        })
        setCorrect(res.correct)
        setPhase("explanation")
      } finally {
        setSubmitting(false)
      }
    },
    [phase, submitting, sessionId, question],
  )

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-lg">
      <header className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          Question {question.index + 1} / {question.total}
        </span>
        <span className="flex items-center gap-2">
          {isFirstEncounter && (
            <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-200">
              {t.session.firstEncounter}
            </span>
          )}
          {isAnki && (
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-200">
              Anki
            </span>
          )}
          {focusTags.map((tag) => (
            <span
              key={`${tag.facet}:${tag.tag}`}
              className="rounded-full border border-white/10 px-2 py-0.5 text-xs uppercase tracking-wide"
            >
              {tag.tag}
            </span>
          ))}
        </span>
      </header>

      {phase === "options" && (
        <>
          <Cue
            question={question}
            showTranslation={showTranslation}
            onToggleTranslation={() => setShowTranslation((v) => !v)}
          />
          <ul className="grid gap-2">
            {question.options.map((option, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => pickOption(idx)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-zinc-100 transition hover:bg-white/10 disabled:cursor-default"
                >
                  <span className="mr-3 font-mono text-zinc-400">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  {optionSegments[idx]?.map((seg, i) =>
                    seg.emphasize ? (
                      <span
                        key={i}
                        className="font-semibold underline decoration-emerald-300/60 decoration-2 underline-offset-4"
                      >
                        {seg.text}
                      </span>
                    ) : (
                      <span key={i} className="text-zinc-500">
                        {seg.text}
                      </span>
                    ),
                  ) ?? option}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {phase === "ankiPrompt" && (
        <>
          <Cue
            question={question}
            showTranslation={showTranslation}
            onToggleTranslation={() => setShowTranslation((v) => !v)}
          />
          <button
            type="button"
            onClick={reveal}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-200 transition hover:bg-white/10"
          >
            Show answer
          </button>
        </>
      )}

      {phase === "ankiReveal" && (
        <>
          <p className="text-lg leading-relaxed text-zinc-50">
            {cueSplit ? (
              <>
                {cueSplit.before}
                <mark className="rounded bg-emerald-400/20 px-1 text-emerald-200">
                  {correctOption}
                </mark>
                {cueSplit.after}
              </>
            ) : (
              <>
                {question.cue}
                <span className="ml-2 rounded bg-emerald-400/20 px-1 text-emerald-200">
                  {correctOption}
                </span>
              </>
            )}
          </p>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-400">Did you know it?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => pickSelfGrade("again")}
                className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-3 text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-default"
              >
                Wrong
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => pickSelfGrade("good")}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-3 text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-default"
              >
                Right
              </button>
            </div>
          </div>
        </>
      )}

      {phase === "explanation" && (
        <ExplanationPanel
          correct={correct === true}
          cue={question.cue}
          cueSplit={cueSplit}
          correctOption={correctOption}
          chosenOption={
            chosenIndex !== null ? question.options[chosenIndex] : null
          }
          showChosen={correct === false}
          explanation={question.explanation}
          progressFilled={progressFilled}
          durationMs={durationMs}
          onSkip={skipExplanation}
        />
      )}
    </div>
  )
}

interface CueProps {
  question: ServedQuestionDTO
  showTranslation: boolean
  onToggleTranslation: () => void
}

function Cue({ question, showTranslation, onToggleTranslation }: CueProps) {
  const split = splitCueAroundBlank(question.cue)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg leading-relaxed text-zinc-50">
        {split && question.blankHint !== null ? (
          <>
            {split.before}
            {BLANK_MARKER}
            <span className="italic text-zinc-500"> ({question.blankHint})</span>
            {split.after}
          </>
        ) : (
          question.cue
        )}
      </p>
      {question.translation !== null && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onToggleTranslation}
            className="self-start text-xs uppercase tracking-wide text-zinc-500 transition hover:text-zinc-300"
          >
            {showTranslation ? t.session.hideTranslation : t.session.showTranslation}
          </button>
          {showTranslation && (
            <p className="text-sm italic text-zinc-500">{question.translation}</p>
          )}
        </div>
      )}
    </div>
  )
}

interface ExplanationPanelProps {
  correct: boolean
  cue: string
  cueSplit: { before: string; after: string } | null
  correctOption: string
  chosenOption: string | null
  showChosen: boolean
  explanation: string
  progressFilled: boolean
  durationMs: number
  onSkip: () => void
}

function ExplanationPanel({
  correct,
  cue,
  cueSplit,
  correctOption,
  chosenOption,
  showChosen,
  explanation,
  progressFilled,
  durationMs,
  onSkip,
}: ExplanationPanelProps) {
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-label={t.session.tapToContinue}
      className="flex cursor-pointer flex-col gap-3 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/50 p-4 text-left transition hover:bg-zinc-950/70"
    >
      <div className="-mx-4 -mt-4 h-1 bg-white/5">
        <div
          className="h-full bg-white/60"
          style={{
            width: progressFilled ? "100%" : "0%",
            transition: `width ${durationMs}ms linear`,
          }}
        />
      </div>
      <div
        className={`text-sm font-semibold ${correct ? "text-emerald-300" : "text-rose-300"}`}
      >
        {correct ? t.session.correct : t.session.incorrect}
      </div>
      <p className="text-zinc-200">
        {cueSplit ? (
          <>
            {cueSplit.before}
            <mark className="rounded bg-emerald-400/20 px-1 text-emerald-200">
              {correctOption}
            </mark>
            {cueSplit.after}
          </>
        ) : (
          <>
            {cue}
            <span className="ml-2 rounded bg-emerald-400/20 px-1 text-emerald-200">
              {correctOption}
            </span>
          </>
        )}
      </p>
      {showChosen && chosenOption !== null && (
        <p className="text-sm text-rose-300/80">
          <span className="text-zinc-500">→ </span>
          <s>{chosenOption}</s>
        </p>
      )}
      <p className="text-zinc-300">{explanation}</p>
    </button>
  )
}

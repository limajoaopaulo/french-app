"use client"

import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { QuestionCard } from "@/components/session/QuestionCard"
import { endSession, serveNext, type ServedQuestionDTO } from "@/app/actions/session"
import { t } from "@/lib/i18n"

interface Props {
  sessionId: number
  firstQuestion: ServedQuestionDTO | null
  focusHeader: string | null
}

export function SessionRunner({ sessionId, firstQuestion, focusHeader }: Props) {
  const router = useRouter()
  const [current, setCurrent] = useState<ServedQuestionDTO | null>(firstQuestion)
  const [finishing, setFinishing] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  const finish = useCallback(async () => {
    setFinishing(true)
    await endSession(sessionId)
    router.push(`/session/${sessionId}/end`)
  }, [router, sessionId])

  const advance = useCallback(async () => {
    const next = await serveNext(sessionId)
    if ("done" in next) {
      await finish()
      return
    }
    setCurrent(next)
  }, [sessionId, finish])

  if (finishing) {
    return <p className="text-zinc-400">Calcul du rang…</p>
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-xl text-zinc-300">
        <p>Pas de question disponible. Vérifie les sous-catégories actives dans les paramètres.</p>
        <button
          type="button"
          onClick={finish}
          className="mt-4 rounded-lg bg-white px-4 py-2 text-sm text-zinc-900"
        >
          Retour
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {focusHeader ? (
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Drill : {focusHeader}
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setShowEndConfirm(true)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 transition hover:bg-white/10"
        >
          {t.session.endDrill}
        </button>
      </div>
      <QuestionCard
        key={current.questionId}
        sessionId={sessionId}
        question={current}
        onAdvance={advance}
      />
      {showEndConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-drill-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-xl">
            <h2
              id="end-drill-title"
              className="text-base font-semibold text-zinc-50"
            >
              {t.session.endDrillConfirmTitle}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {t.session.endDrillConfirmBody}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
              >
                {t.session.endDrillConfirmNo}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndConfirm(false)
                  void finish()
                }}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
              >
                {t.session.endDrillConfirmYes}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

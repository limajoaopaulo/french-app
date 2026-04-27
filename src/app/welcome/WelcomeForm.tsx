"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createUser, signIn } from "@/app/actions/auth"

type Mode = "signin" | "signup"
type Lang = "fr" | "pt"

export function WelcomeForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("signin")
  const [language, setLanguage] = useState<Lang>("fr")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        if (mode === "signup") {
          await createUser({
            username,
            displayName: displayName || username,
            pin: pin || undefined,
            languageCode: language,
          })
        } else {
          await signIn({ username, pin: pin || undefined })
        }
        router.push("/")
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 rounded-lg bg-white/5 p-1">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
            mode === "signin" ? "bg-white text-zinc-900" : "text-zinc-300 hover:bg-white/5"
          }`}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
            mode === "signup" ? "bg-white text-zinc-900" : "text-zinc-300 hover:bg-white/5"
          }`}
          onClick={() => setMode("signup")}
        >
          New user
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wide text-zinc-400">
              Pick your language
            </label>
            <div className="grid grid-cols-2 gap-2">
              <LangCard
                code="fr"
                emoji="🇫🇷"
                label="French"
                selected={language === "fr"}
                onSelect={() => setLanguage("fr")}
              />
              <LangCard
                code="pt"
                emoji="🇧🇷"
                label="Portuguese (BR)"
                selected={language === "pt"}
                onSelect={() => setLanguage("pt")}
              />
            </div>
          </div>
        )}

        <Field label="Username">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
          />
        </Field>

        {mode === "signup" && (
          <Field label="Display name (optional)">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
            />
          </Field>
        )}

        <Field
          label={mode === "signup" ? "4-digit PIN (optional)" : "4-digit PIN"}
        >
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder={mode === "signup" ? "Leave blank to skip" : ""}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm tracking-[0.5em] focus:border-white/30 focus:outline-none"
          />
        </Field>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {isPending ? "..." : mode === "signup" ? "Create user" : "Sign in"}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

function LangCard({
  code,
  emoji,
  label,
  selected,
  onSelect,
}: {
  code: Lang
  emoji: string
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 transition ${
        selected
          ? "border-white bg-white/10"
          : "border-white/10 bg-white/[0.02] hover:border-white/30"
      }`}
      aria-pressed={selected}
      data-language-code={code}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

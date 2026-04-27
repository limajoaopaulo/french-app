import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { WelcomeForm } from "./WelcomeForm"

export const dynamic = "force-dynamic"

export default async function WelcomePage() {
  const user = await getCurrentUser()
  if (user) redirect("/")

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/60 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">Adaptive Quiz</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Sign in or create a new user. One language per user.
        </p>
        <WelcomeForm />
      </div>
    </main>
  )
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-xl animate-pulse flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-zinc-900/60" />
          <div className="h-4 w-16 rounded bg-zinc-900/60" />
        </div>
        <div className="h-2 rounded-full bg-zinc-900/60" />
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-8">
          <div className="mb-6 h-6 w-3/4 rounded bg-zinc-800/60" />
          <div className="flex flex-col gap-3">
            <div className="h-12 rounded-lg border border-white/10 bg-zinc-800/40" />
            <div className="h-12 rounded-lg border border-white/10 bg-zinc-800/40" />
            <div className="h-12 rounded-lg border border-white/10 bg-zinc-800/40" />
            <div className="h-12 rounded-lg border border-white/10 bg-zinc-800/40" />
          </div>
        </div>
      </div>
    </main>
  )
}

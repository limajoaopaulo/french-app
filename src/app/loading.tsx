export default function Loading() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100">
      <div className="mx-auto flex w-full max-w-xl animate-pulse flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="h-8 w-2/3 rounded-md bg-zinc-900/60" />
          <div className="h-4 w-1/2 rounded-md bg-zinc-900/40" />
        </div>
        <div className="h-12 rounded-xl border border-white/5 bg-zinc-900/40" />
        <div className="h-12 rounded-xl border border-white/5 bg-zinc-900/40" />
        <div className="h-40 rounded-2xl border border-white/10 bg-zinc-900/40" />
        <div className="h-44 rounded-2xl border border-white/10 bg-zinc-900/40" />
        <div className="h-32 rounded-2xl border border-white/10 bg-zinc-900/40" />
      </div>
    </main>
  )
}

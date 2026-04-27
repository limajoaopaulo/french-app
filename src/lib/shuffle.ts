export interface ShuffleableQuestion {
  options: string[]
  correctIndex: number
}

export function shuffleOptions<T extends ShuffleableQuestion>(q: T): T {
  const n = q.options.length
  const indices = Array.from({ length: n }, (_, i) => i)

  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }

  const newOptions = indices.map((i) => q.options[i])
  const newCorrectIndex = indices.indexOf(q.correctIndex)

  return { ...q, options: newOptions, correctIndex: newCorrectIndex }
}

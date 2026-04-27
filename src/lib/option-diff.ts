// Splits each option into segments, marking which slice is the meaningful
// difference vs the parts that are common across all options. Renderers
// dim the common parts so the user only re-reads what actually changes.

export interface OptionSegment {
  text: string
  emphasize: boolean
}

const MIN_COMMON_CHARS = 4

export function diffOptions(options: readonly string[]): OptionSegment[][] {
  if (options.length === 0) return []
  if (options.length === 1) {
    return [[{ text: options[0], emphasize: true }]]
  }

  const prefix = longestCommonPrefix(options)
  const tails = options.map((o) => o.slice(prefix.length))
  const suffix = longestCommonSuffix(tails)

  const totalCommon = prefix.length + suffix.length
  const minOptionLen = Math.min(...options.map((o) => o.length))

  // Don't dim unless the common parts are meaningful AND the diff still
  // exists for every option. If totalCommon ≥ minOptionLen, at least one
  // option would render as empty middle — fall back to plain emphasize-all.
  if (totalCommon < MIN_COMMON_CHARS || totalCommon >= minOptionLen) {
    return options.map((o) => [{ text: o, emphasize: true }])
  }

  return options.map((o) => {
    const middle = o.slice(prefix.length, o.length - suffix.length)
    const segments: OptionSegment[] = []
    if (prefix.length > 0) segments.push({ text: prefix, emphasize: false })
    segments.push({ text: middle, emphasize: true })
    if (suffix.length > 0) segments.push({ text: suffix, emphasize: false })
    return segments
  })
}

function longestCommonPrefix(strings: readonly string[]): string {
  if (strings.length === 0) return ""
  let i = 0
  const first = strings[0]
  while (i < first.length) {
    const ch = first[i]
    if (!strings.every((s) => s[i] === ch)) break
    i++
  }
  return first.slice(0, i)
}

function longestCommonSuffix(strings: readonly string[]): string {
  if (strings.length === 0) return ""
  let i = 0
  const first = strings[0]
  while (i < first.length) {
    const ch = first[first.length - 1 - i]
    if (!strings.every((s) => s[s.length - 1 - i] === ch)) break
    i++
  }
  return first.slice(first.length - i)
}

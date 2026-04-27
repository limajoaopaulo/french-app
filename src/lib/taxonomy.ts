import frRaw from "@/data/fr/taxonomy.json"
import ptRaw from "@/data/pt/taxonomy.json"

export type Domain = "grammar" | "vocabulary"
export type LanguageCode = "fr" | "pt"

export interface SubInfo {
  key: string
  label: string
  shortLabel: string
  hint: string
  patterns: string[]
}

export interface DomainInfo {
  key: Domain
  label: string
  color: string
  subs: SubInfo[]
}

export type DomainsByKey = Record<Domain, DomainInfo>

interface RawDomain {
  label: string
  color: string
  subs: Record<
    string,
    { label: string; shortLabel?: string; hint: string; patterns?: string[] }
  >
}

interface RawTaxonomy {
  domains: { grammar: RawDomain; vocabulary: RawDomain }
  default_active: { grammar: string[]; vocabulary: string[] }
}

const RAW: Record<LanguageCode, RawTaxonomy> = {
  fr: frRaw as RawTaxonomy,
  pt: ptRaw as RawTaxonomy,
}

function toDomainInfo(key: Domain, d: RawDomain): DomainInfo {
  const subs: SubInfo[] = Object.entries(d.subs).map(([k, v]) => ({
    key: k,
    label: v.label,
    shortLabel: v.shortLabel ?? v.label,
    hint: v.hint,
    patterns: v.patterns ?? [],
  }))
  return { key, label: d.label, color: d.color, subs }
}

export function getDomains(language: LanguageCode): DomainsByKey {
  const raw = RAW[language]
  return {
    grammar: toDomainInfo("grammar", raw.domains.grammar),
    vocabulary: toDomainInfo("vocabulary", raw.domains.vocabulary),
  }
}

export function getDefaultActive(language: LanguageCode): {
  grammar: readonly string[]
  vocabulary: readonly string[]
} {
  const raw = RAW[language]
  return {
    grammar: raw.default_active.grammar,
    vocabulary: raw.default_active.vocabulary,
  }
}

export function allSubs(
  language: LanguageCode,
): Array<{ domain: Domain; sub: string; label: string; hint: string }> {
  const domains = getDomains(language)
  return (Object.keys(domains) as Domain[]).flatMap((d) =>
    domains[d].subs.map((s) => ({ domain: d, sub: s.key, label: s.label, hint: s.hint })),
  )
}

export function isDefaultActive(
  language: LanguageCode,
  domain: Domain,
  sub: string,
): boolean {
  return (getDefaultActive(language)[domain] as readonly string[]).includes(sub)
}

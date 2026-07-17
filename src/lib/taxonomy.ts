import frFacets from "@/data/fr/facets.json"
import ptFacets from "@/data/pt/facets.json"

export type LanguageCode = "fr" | "pt"

// -----------------------------------------------------------------------------
// Facet/tag taxonomy (new model). Two facets: grammar + topic. Each tag carries
// a frequency (1-5) used to weight the linear curriculum. Loaded from
// src/data/<lang>/facets.json.
// -----------------------------------------------------------------------------

export type Facet = "grammar" | "topic"

export interface TagInfo {
  key: string
  label: string
  shortLabel: string
  frequency: number
}

export interface FacetInfo {
  key: Facet
  label: string
  color: string
  tags: TagInfo[]
}

export type FacetsByKey = Record<Facet, FacetInfo>

interface RawFacet {
  label: string
  color: string
  tags: Record<string, { label: string; shortLabel?: string; frequency?: number }>
}

interface RawFacetTaxonomy {
  facets: { grammar: RawFacet; topic: RawFacet }
  default_active: { grammar: string[]; topic: string[] }
}

const FACET_RAW: Record<LanguageCode, RawFacetTaxonomy> = {
  fr: frFacets as RawFacetTaxonomy,
  pt: ptFacets as RawFacetTaxonomy,
}

export const FACETS: readonly Facet[] = ["grammar", "topic"] as const

function toFacetInfo(key: Facet, f: RawFacet): FacetInfo {
  const tags: TagInfo[] = Object.entries(f.tags).map(([k, v]) => ({
    key: k,
    label: v.label,
    shortLabel: v.shortLabel ?? v.label,
    frequency: v.frequency ?? 3,
  }))
  return { key, label: f.label, color: f.color, tags }
}

export function getFacets(language: LanguageCode): FacetsByKey {
  const raw = FACET_RAW[language]
  return {
    grammar: toFacetInfo("grammar", raw.facets.grammar),
    topic: toFacetInfo("topic", raw.facets.topic),
  }
}

export function allTags(
  language: LanguageCode,
): Array<{ facet: Facet; tag: string; label: string; shortLabel: string; frequency: number }> {
  const facets = getFacets(language)
  return FACETS.flatMap((f) =>
    facets[f].tags.map((t) => ({
      facet: f,
      tag: t.key,
      label: t.label,
      shortLabel: t.shortLabel,
      frequency: t.frequency,
    })),
  )
}

function tagInfoMap(language: LanguageCode): Map<string, TagInfo & { facet: Facet }> {
  const facets = getFacets(language)
  const m = new Map<string, TagInfo & { facet: Facet }>()
  for (const f of FACETS) {
    for (const t of facets[f].tags) m.set(`${f}::${t.key}`, { ...t, facet: f })
  }
  return m
}

const TAG_INFO_CACHE: Partial<Record<LanguageCode, Map<string, TagInfo & { facet: Facet }>>> = {}
function tagInfo(language: LanguageCode, facet: Facet, tag: string): (TagInfo & { facet: Facet }) | undefined {
  const cache = (TAG_INFO_CACHE[language] ??= tagInfoMap(language))
  return cache.get(`${facet}::${tag}`)
}

export function frequencyOf(language: LanguageCode, facet: Facet, tag: string): number {
  return tagInfo(language, facet, tag)?.frequency ?? 3
}

export function tagLabel(language: LanguageCode, facet: Facet, tag: string): string {
  return tagInfo(language, facet, tag)?.label ?? tag
}

export function tagShortLabel(language: LanguageCode, facet: Facet, tag: string): string {
  return tagInfo(language, facet, tag)?.shortLabel ?? tag
}

export function tagExists(language: LanguageCode, facet: string, tag: string): boolean {
  if (facet !== "grammar" && facet !== "topic") return false
  return tagInfo(language, facet, tag) !== undefined
}

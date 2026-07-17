import { describe, expect, test } from "vitest"
import { State } from "@/lib/fsrs"
import {
  bucketCardsByTag,
  subLevelFromCards,
  subRetrievabilitySummary,
  tagKey,
  type CardTag,
  type TaggedCard,
} from "@/lib/levels"

function taggedCard(
  level: number,
  stability: number,
  tags: CardTag[],
): TaggedCard {
  return {
    level,
    stability,
    difficulty: 5,
    state: stability > 0 ? State.Review : State.New,
    scheduledDays: 0,
    learningSteps: 0,
    reps: stability > 0 ? 1 : 0,
    lapses: 0,
    lastReview: stability > 0 ? new Date("2026-01-01T00:00:00Z") : null,
    dueAt: stability > 0 ? new Date("2026-01-11T00:00:00Z") : null,
    tags,
  }
}

describe("bucketCardsByTag", () => {
  test("fans a card into every tag it carries", () => {
    const cards = [
      taggedCard(2, 5, [
        { facet: "grammar", tag: "passe_compose", role: "focus" },
        { facet: "grammar", tag: "aux_avoir", role: "focus" },
        { facet: "topic", tag: "restaurant", role: "context" },
      ]),
    ]
    const buckets = bucketCardsByTag(cards)
    expect(buckets.size).toBe(3)
    expect(buckets.get(tagKey("grammar", "passe_compose"))?.allCards).toHaveLength(1)
    expect(buckets.get(tagKey("topic", "restaurant"))?.allCards).toHaveLength(1)
  })

  test("focus vs context: context cards count for exposure but NOT graduation", () => {
    // 5 grammar-focus cards at level 2, each carrying `daily_life` as CONTEXT.
    // grammar tag should graduate to A2; daily_life must NOT (0 focus cards).
    const cards: TaggedCard[] = Array.from({ length: 5 }, () =>
      taggedCard(2, 3, [
        { facet: "grammar", tag: "passe_compose", role: "focus" },
        { facet: "topic", tag: "daily_life", role: "context" },
      ]),
    )
    const buckets = bucketCardsByTag(cards)

    const grammar = buckets.get(tagKey("grammar", "passe_compose"))!
    const topic = buckets.get(tagKey("topic", "daily_life"))!

    // grammar levels up from its focus cards
    expect(grammar.focusCards).toHaveLength(5)
    expect(subLevelFromCards(grammar.focusCards)).toBeGreaterThanOrEqual(2)

    // daily_life has exposure (allCards) but zero focus → cannot graduate
    expect(topic.allCards).toHaveLength(5)
    expect(topic.focusCards).toHaveLength(0)
    expect(subLevelFromCards(topic.focusCards)).toBe(0)

    // ...yet daily_life still gets a non-zero retrievability signal from allCards
    const now = new Date("2026-01-02T00:00:00Z")
    const summary = subRetrievabilitySummary(topic.allCards, now, 0.9)
    expect(summary.total).toBe(5)
    expect(summary.meanR).toBeGreaterThan(0)
  })

  test("multiple focus tags each get full graduation credit (no inflation)", () => {
    const cards: TaggedCard[] = Array.from({ length: 5 }, () =>
      taggedCard(2, 3, [
        { facet: "grammar", tag: "passe_compose", role: "focus" },
        { facet: "grammar", tag: "aux_avoir", role: "focus" },
      ]),
    )
    const buckets = bucketCardsByTag(cards)
    expect(subLevelFromCards(buckets.get(tagKey("grammar", "passe_compose"))!.focusCards))
      .toBeGreaterThanOrEqual(2)
    expect(subLevelFromCards(buckets.get(tagKey("grammar", "aux_avoir"))!.focusCards))
      .toBeGreaterThanOrEqual(2)
  })

  test("empty input yields no buckets", () => {
    expect(bucketCardsByTag([]).size).toBe(0)
  })
})

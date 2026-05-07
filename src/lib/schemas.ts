import { z } from "zod"

export const DomainSchema = z.enum(["grammar", "vocabulary"])
export type DomainInput = z.infer<typeof DomainSchema>

export const StartPersonalisedSchema = z.object({
  length: z.number().int().min(1).max(50).default(10),
  domainFilter: DomainSchema.optional(),
  targetSubs: z
    .array(
      z.object({
        domain: DomainSchema,
        sub: z.string().min(1),
      }),
    )
    .max(2)
    .optional(),
  levelRange: z
    .object({
      min: z.number().int().min(1).max(5),
      max: z.number().int().min(1).max(5),
    })
    .optional(),
})

export const StartBossSchema = z.object({
  domain: DomainSchema,
  level: z.number().int().min(2).max(5),
})

export const SelfGradeSchema = z.enum(["again", "hard", "good", "easy"])
export type SelfGradeInput = z.infer<typeof SelfGradeSchema>

export const SubmitAnswerSchema = z.object({
  sessionId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  // Multi-choice mode: chosenIndex set, selfGrade null.
  // Anki mode (3rd+ encounter): chosenIndex = -1 (sentinel), selfGrade set.
  chosenIndex: z.number().int().min(-1).max(3),
  displayedCorrectIndex: z.number().int().min(0).max(3),
  levelAtServe: z.number().int().min(1).max(5),
  responseMs: z.number().int().min(0),
  selfGrade: SelfGradeSchema.nullable().optional(),
})

export const ToggleActiveSubSchema = z.object({
  domain: DomainSchema,
  sub: z.string().min(1),
  isActive: z.boolean(),
})

export const SetDefaultDrillLengthSchema = z.object({
  length: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]),
})

export const SpeedTag = z.enum(["fast", "normal", "slow"])
export type SpeedTagInput = z.infer<typeof SpeedTag>

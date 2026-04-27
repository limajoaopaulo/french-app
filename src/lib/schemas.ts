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

export const SubmitAnswerSchema = z.object({
  sessionId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  chosenIndex: z.number().int().min(0).max(3),
  displayedCorrectIndex: z.number().int().min(0).max(3),
  levelAtServe: z.number().int().min(1).max(5),
  responseMs: z.number().int().min(0),
})

export const ToggleActiveSubSchema = z.object({
  domain: DomainSchema,
  sub: z.string().min(1),
  isActive: z.boolean(),
})

export const SpeedTag = z.enum(["fast", "normal", "slow"])
export type SpeedTagInput = z.infer<typeof SpeedTag>

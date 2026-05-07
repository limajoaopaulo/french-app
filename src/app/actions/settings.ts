"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import {
  SetDefaultDrillLengthSchema,
  ToggleActiveSubSchema,
} from "@/lib/schemas"
import { requireUser } from "@/lib/auth"

export async function toggleActiveSub(input: unknown): Promise<void> {
  const user = await requireUser()
  const parsed = ToggleActiveSubSchema.parse(input)
  await prisma.subStats.update({
    where: {
      userId_domain_sub: {
        userId: user.id,
        domain: parsed.domain,
        sub: parsed.sub,
      },
    },
    data: { isActive: parsed.isActive },
  })
  revalidatePath("/settings")
  revalidatePath("/")
}

export async function setDefaultDrillLength(input: unknown): Promise<void> {
  const user = await requireUser()
  const parsed = SetDefaultDrillLengthSchema.parse(input)
  await prisma.user.update({
    where: { id: user.id },
    data: { defaultDrillLength: parsed.length },
  })
  revalidatePath("/settings")
  revalidatePath("/")
}

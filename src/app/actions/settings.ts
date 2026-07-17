"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { SetDefaultDrillLengthSchema } from "@/lib/schemas"
import { requireUser } from "@/lib/auth"

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

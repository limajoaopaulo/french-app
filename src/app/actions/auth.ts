"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/db"
import {
  clearSessionCookie,
  clearSigninBucket,
  hashPin,
  recordSigninAttempt,
  setSessionCookie,
  verifyPin,
} from "@/lib/auth"

const CreateUserSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-z0-9_]+$/i, "letters, numbers, underscore only"),
  displayName: z.string().min(1).max(40),
  // PIN optional. If provided, must be 4 digits.
  pin: z
    .string()
    .regex(/^\d{4}$/, "PIN must be 4 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  languageCode: z.enum(["fr", "pt"]),
})

const SignInSchema = z.object({
  username: z.string().min(1),
  // PIN optional on sign-in too — required only if the stored user has one.
  pin: z
    .string()
    .regex(/^\d{4}$/, "PIN must be 4 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
})

export async function createUser(input: unknown): Promise<{ ok: true }> {
  const parsed = CreateUserSchema.parse(input)
  const username = parsed.username.toLowerCase()

  const lang = await prisma.language.findUnique({
    where: { code: parsed.languageCode },
  })
  if (!lang) throw new Error(`Unknown language: ${parsed.languageCode}`)

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) throw new Error("Username already taken")

  const pinHash = parsed.pin ? await hashPin(parsed.pin) : null
  const user = await prisma.user.create({
    data: {
      username,
      displayName: parsed.displayName,
      pinHash,
      languageId: lang.id,
    },
  })
  // TagStats rows are created lazily on answer — no per-user seeding needed.
  await setSessionCookie(user.id)
  revalidatePath("/")
  return { ok: true }
}

export async function signIn(input: unknown): Promise<{ ok: true }> {
  const parsed = SignInSchema.parse(input)
  const username = parsed.username.toLowerCase()

  const limit = recordSigninAttempt(username)
  if (limit.rateLimited) {
    throw new Error("Too many attempts. Wait 10 minutes.")
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) throw new Error("Invalid username or PIN")

  if (user.pinHash) {
    if (!parsed.pin) throw new Error("PIN required for this user")
    const ok = await verifyPin(parsed.pin, user.pinHash)
    if (!ok) throw new Error("Invalid username or PIN")
  }
  // No pinHash on user → username alone is enough.

  clearSigninBucket(username)
  await setSessionCookie(user.id)
  revalidatePath("/")
  return { ok: true }
}

export async function signOut(): Promise<void> {
  await clearSessionCookie()
  redirect("/welcome")
}

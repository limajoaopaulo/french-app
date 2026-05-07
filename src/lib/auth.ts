import "server-only"
import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import type { LanguageCode } from "@/lib/taxonomy"

const COOKIE_NAME = "fa_session"
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90 // 90 days

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET env var missing or too short (must be ≥32 chars)")
  }
  return new TextEncoder().encode(s)
}

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits")
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

export async function setSessionCookie(userId: number): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SEC}s`)
    .sign(getSecret())
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}

export interface CurrentUser {
  id: number
  username: string
  displayName: string
  languageId: number
  languageCode: LanguageCode
  defaultDrillLength: number
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  let userId: number
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (typeof payload.uid !== "number") return null
    userId = payload.uid
  } catch {
    return null
  }
  const row = await prisma.user.findUnique({
    where: { id: userId },
    include: { language: true },
  })
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    languageId: row.languageId,
    languageCode: row.language.code as LanguageCode,
    defaultDrillLength: row.defaultDrillLength,
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser()
  if (!u) throw new Error("Not signed in")
  return u
}

// In-memory rate limiter — fine for single-instance dev. Resets on process restart.
const SIGNIN_BUCKET = new Map<string, { count: number; firstAt: number }>()
const SIGNIN_WINDOW_MS = 10 * 60 * 1000
const SIGNIN_MAX = 5

export function recordSigninAttempt(username: string): { rateLimited: boolean } {
  const now = Date.now()
  const cur = SIGNIN_BUCKET.get(username)
  if (!cur || now - cur.firstAt > SIGNIN_WINDOW_MS) {
    SIGNIN_BUCKET.set(username, { count: 1, firstAt: now })
    return { rateLimited: false }
  }
  cur.count++
  return { rateLimited: cur.count > SIGNIN_MAX }
}

export function clearSigninBucket(username: string): void {
  SIGNIN_BUCKET.delete(username)
}

import type { H3Event } from 'h3'
import { SignJWT, jwtVerify } from 'jose'
import { APP_SLUG } from '#shared/app'

// A signed JWT in an httpOnly cookie that names a row in `sessions`. The
// signature makes forged cookies cheap to reject without a query; the row
// makes real ones revocable (logout deletes it, "sign out everywhere"
// deletes them all). Rotating NUXT_SESSION_SECRET still invalidates
// everything at once.
const SESSION_COOKIE = `${APP_SLUG}_session`
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
// last_seen_at is refreshed at most this often, so reads stay reads.
const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000

export interface SessionUser {
  id: string
  email: string
  sessionId: string
}

// One lookup per request, however many handlers ask.
const resolved = new WeakMap<H3Event, SessionUser | null>()

function sessionSecret () {
  const { sessionSecret: secret } = useRuntimeConfig()
  if (secret) return new TextEncoder().encode(secret)
  if (import.meta.dev) return new TextEncoder().encode(`${APP_SLUG}-dev-session-secret-not-for-production`)
  throw createError({ statusCode: 500, statusMessage: 'NUXT_SESSION_SECRET is not set' })
}

export async function startSession (event: H3Event, user: { id: string, email: string }) {
  const row = await createSession(user.id, getRequestHeader(event, 'user-agent') ?? '', SESSION_TTL_SECONDS)
  const token = await new SignJWT({ email: user.email, sid: row.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret())

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
    path: '/'
  })
  resolved.set(event, { id: user.id, email: user.email, sessionId: row.id })
}

// Clears the cookie and deletes the row behind it, so the token is dead
// even if a copy survives somewhere.
export async function endSession (event: H3Event) {
  const user = await getSessionUser(event)
  if (user) await deleteSession(user.sessionId).catch(() => { /* already gone */ })
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  resolved.set(event, null)
}

export async function getSessionUser (event: H3Event): Promise<SessionUser | null> {
  if (resolved.has(event)) return resolved.get(event) ?? null
  const user = await readSession(event)
  resolved.set(event, user)
  return user
}

async function readSession (event: H3Event): Promise<SessionUser | null> {
  const raw = getCookie(event, SESSION_COOKIE)
  if (!raw) return null
  let sub: string, email: string, sid: string
  try {
    const { payload } = await jwtVerify(raw, sessionSecret())
    if (!payload.sub || typeof payload.email !== 'string' || typeof payload.sid !== 'string') return null
    sub = payload.sub
    email = payload.email
    sid = payload.sid
  } catch {
    return null
  }

  const row = await findSession(sid)
  if (!row || row.userId !== sub || new Date(row.expiresAt).getTime() <= Date.now()) {
    // Revoked or expired: drop the dead cookie so the browser stops sending it.
    deleteCookie(event, SESSION_COOKIE, { path: '/' })
    return null
  }
  if (Date.now() - new Date(row.lastSeenAt).getTime() > LAST_SEEN_REFRESH_MS) {
    await touchSession(sid).catch(() => { /* best effort */ })
  }
  return { id: sub, email, sessionId: sid }
}

export async function requireUser (event: H3Event): Promise<SessionUser> {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  return user
}

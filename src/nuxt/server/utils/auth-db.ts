import { and, eq, gt, isNull, lt, ne, sql } from 'drizzle-orm'

// Queries over the NuxtHub drizzle client (`db` and `schema` are
// auto-imported server globals provided by @nuxthub/core).

// Expiry columns hold ISO strings written by the app, so "now" has to be one
// too. SQLite's datetime('now') reads '2026-10-01 12:00:00', which sorts
// below every ISO time on the same day ('T' > ' ') — compared against it, a
// 15-minute link stayed valid until midnight UTC.
function nowIso (): string {
  return new Date().toISOString()
}

export interface DbUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarKey: string | null
  palette: string | null
  onboardingDismissedAt: string | null
}

// Hard ceiling on accounts: with open magic-link signup this is what bounds
// the app's entire resource footprint (D1 rows, R2 avatars, email sends).
// Raise deliberately, not by accident.
function maxUsers (): number {
  return Math.max(Number.parseInt(useRuntimeConfig().maxUsers, 10) || 250, 1)
}

export async function ensureUser (email: string): Promise<DbUser> {
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).get()
  if (existing) return existing
  const userCount = await db.select({ n: sql<number>`count(*)` }).from(schema.users).get()
  if ((userCount?.n ?? 0) >= maxUsers()) {
    throw createError({ statusCode: 503, statusMessage: 'Sign-ups are full right now — check back later.' })
  }
  const id = crypto.randomUUID()
  await db.insert(schema.users).values({ id, email }).run()
  return { id, email, firstName: null, lastName: null, avatarKey: null, palette: null, onboardingDismissedAt: null }
}

export async function getUserById (id: string): Promise<DbUser | null> {
  return await db.select().from(schema.users).where(eq(schema.users.id, id)).get() ?? null
}

export async function getUserByEmail (email: string): Promise<DbUser | null> {
  return await db.select().from(schema.users).where(eq(schema.users.email, email)).get() ?? null
}

export interface ProfilePatch {
  firstName?: string | null
  lastName?: string | null
  palette?: string | null
  onboardingDismissedAt?: string | null
}

export async function updateUserProfile (id: string, patch: ProfilePatch): Promise<void> {
  if (!Object.keys(patch).length) return
  await db.update(schema.users).set(patch).where(eq(schema.users.id, id)).run()
}

export async function setUserAvatarKey (id: string, avatarKey: string | null): Promise<void> {
  await db.update(schema.users).set({ avatarKey }).where(eq(schema.users.id, id)).run()
}

// "Jon" / "Jon Knoll" / the email's local part — for emails and lists.
export function displayNameOf (user: { firstName?: string | null, lastName?: string | null, email: string }): string {
  const full = [user.firstName, user.lastName].map(p => p?.trim()).filter(Boolean).join(' ')
  return full || user.email.split('@')[0] || user.email
}

// ---- Login tokens ------------------------------------------------------------

export async function insertLoginToken (tokenHash: string, email: string, expiresAt: string): Promise<void> {
  // Spent and expired hashes are worthless; sweep them so the table stays
  // the size of "links in flight".
  await db.delete(schema.loginTokens).where(lt(schema.loginTokens.expiresAt, nowIso())).run()
  await db.insert(schema.loginTokens).values({ tokenHash, email, expiresAt }).run()
}

// Marks the token used and returns its email in one statement, so a token
// can never be spent twice.
export async function spendLoginToken (tokenHash: string): Promise<string | null> {
  const rows = await db.update(schema.loginTokens)
    .set({ usedAt: sql`datetime('now')` })
    .where(and(
      eq(schema.loginTokens.tokenHash, tokenHash),
      isNull(schema.loginTokens.usedAt),
      gt(schema.loginTokens.expiresAt, nowIso())
    ))
    .returning({ email: schema.loginTokens.email })
  return rows[0]?.email ?? null
}

// ---- Sessions ----------------------------------------------------------------

export interface SessionRow {
  id: string
  userId: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
}

const MAX_UA = 300

export async function createSession (userId: string, userAgent: string, ttlSeconds: number): Promise<SessionRow> {
  // Expired rows are dead weight; sweep on the write path so nothing needs
  // a cron.
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, nowIso())).run()
  const now = new Date()
  const row: SessionRow = {
    id: crypto.randomUUID(),
    userId,
    userAgent: userAgent.slice(0, MAX_UA),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString()
  }
  await db.insert(schema.sessions).values(row).run()
  return row
}

export async function findSession (id: string): Promise<SessionRow | null> {
  return await db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get() ?? null
}

export async function touchSession (id: string): Promise<void> {
  await db.update(schema.sessions).set({ lastSeenAt: new Date().toISOString() }).where(eq(schema.sessions.id, id)).run()
}

export async function deleteSession (id: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run()
}

// Every session for the user, optionally sparing one (the browser asking).
export async function deleteUserSessions (userId: string, exceptId?: string): Promise<number> {
  const where = exceptId
    ? and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, exceptId))
    : eq(schema.sessions.userId, userId)
  const rows = await db.delete(schema.sessions).where(where).returning({ id: schema.sessions.id })
  return rows.length
}

export async function listUserSessions (userId: string): Promise<SessionRow[]> {
  return await db.select().from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), gt(schema.sessions.expiresAt, nowIso())))
    .all()
}

// ---- Passkeys ----------------------------------------------------------------

export interface PasskeyRow {
  id: string
  userId: string
  publicKey: string
  counter: number
  transports: string
  backedUp: boolean
  aaguid: string
  userAgent: string
  createdAt: string
  lastUsedAt: string | null
}

export async function listUserPasskeys (userId: string): Promise<PasskeyRow[]> {
  return await db.select().from(schema.passkeys)
    .where(eq(schema.passkeys.userId, userId))
    .orderBy(schema.passkeys.createdAt)
    .all()
}

export async function countUserPasskeys (userId: string): Promise<number> {
  const row = await db.select({ n: sql<number>`count(*)` }).from(schema.passkeys)
    .where(eq(schema.passkeys.userId, userId))
    .get()
  return row?.n ?? 0
}

export async function findPasskey (id: string): Promise<PasskeyRow | null> {
  return await db.select().from(schema.passkeys).where(eq(schema.passkeys.id, id)).get() ?? null
}

// False when the credential is already registered — to anyone.
export async function insertPasskey (row: PasskeyRow): Promise<boolean> {
  const rows = await db.insert(schema.passkeys).values(row).onConflictDoNothing()
    .returning({ id: schema.passkeys.id })
  return rows.length > 0
}

export async function recordPasskeyUse (id: string, counter: number, backedUp: boolean): Promise<void> {
  await db.update(schema.passkeys)
    .set({ counter, backedUp, lastUsedAt: nowIso() })
    .where(eq(schema.passkeys.id, id))
    .run()
}

// Scoped to the owner, so a guessed id can't remove someone else's passkey.
export async function deleteUserPasskey (userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(schema.passkeys)
    .where(and(eq(schema.passkeys.userId, userId), eq(schema.passkeys.id, id)))
    .returning({ id: schema.passkeys.id })
  return rows.length > 0
}

// Records a WebAuthn challenge as answered. False when it already was: the
// primary key turns a replay into a conflict, atomically.
export async function spendPasskeyChallenge (challenge: string, expiresAt: string): Promise<boolean> {
  await db.delete(schema.passkeyChallenges).where(lt(schema.passkeyChallenges.expiresAt, nowIso())).run()
  const rows = await db.insert(schema.passkeyChallenges).values({ challenge, expiresAt }).onConflictDoNothing()
    .returning({ challenge: schema.passkeyChallenges.challenge })
  return rows.length > 0
}

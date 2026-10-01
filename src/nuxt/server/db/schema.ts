import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Every table an app built on this template starts with. Add your own below;
// `npx nuxt db generate` writes the migration.

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  // R2 object key for an uploaded avatar. Null = fall back to Gravatar.
  avatarKey: text('avatar_key'),
  // Colour palette id (shared/types/palette.ts). Null = the default teal.
  palette: text('palette'),
  // When the home "fill in your profile" card was skipped. Null = still shown.
  onboardingDismissedAt: text('onboarding_dismissed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
})

// Magic-link tokens in flight: only the SHA-256 digest is stored, and a row
// is spent (used_at set) exactly once.
export const loginTokens = sqliteTable('login_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  email: text('email').notNull(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at')
})

// One row per signed-in browser. The session cookie is a signed JWT that
// names a row here, so deleting the row revokes that cookie for good —
// "sign out everywhere" is a delete, not a wait for expiry.
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userAgent: text('user_agent').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  lastSeenAt: text('last_seen_at').notNull(),
  expiresAt: text('expires_at').notNull()
}, table => [index('sessions_user_idx').on(table.userId)])

// Passkeys (WebAuthn credentials). One can only be added from a signed-in
// session, and every account's first session comes from a magic link, so a
// passkey always hangs off an address someone proved they own. The email
// link keeps working beside them: removing every passkey locks no one out.
export const passkeys = sqliteTable('passkeys', {
  // The credential id (base64url) the browser hands back on every sign-in.
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  // COSE-encoded public key, base64url. There is no secret on this side.
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  // Comma-separated transport hints (internal, hybrid, usb, …).
  transports: text('transports').notNull().default(''),
  // Synced to a cloud keychain, so it survives losing the device.
  backedUp: integer('backed_up', { mode: 'boolean' }).notNull().default(false),
  // Identifies the provider (Apple Passwords, 1Password, …) for the label.
  aaguid: text('aaguid').notNull().default(''),
  userAgent: text('user_agent').notNull().default(''),
  createdAt: text('created_at').notNull(),
  lastUsedAt: text('last_used_at')
}, table => [index('passkeys_user_idx').on(table.userId)])

// WebAuthn challenges that have been answered. Challenges are handed out
// stateless (signed, in server/utils/passkeys.ts) so showing the sign-in
// page writes nothing; a row lands here only when one is spent, and the
// primary key is what makes it single-use. Rows are swept once expired.
export const passkeyChallenges = sqliteTable('passkey_challenges', {
  challenge: text('challenge').primaryKey(),
  expiresAt: text('expires_at').notNull()
})

// Feedback: bug reports and suggestions from signed-in users. `body` is raw
// Markdown exactly as submitted — never trusted, only ever rendered through
// markdown-it with html disabled (so any tags inside are escaped text).
// The table stays even when the feedback module is compiled out; an empty
// table costs nothing and keeps migrations linear.
export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  body: text('body').notNull().default(''),
  page: text('page').notNull().default(''),
  userAgent: text('user_agent').notNull().default(''),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
})

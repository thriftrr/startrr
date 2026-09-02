import { createHash, randomBytes } from 'node:crypto'

// Token hygiene mirrors hivrr's password reset flow: 256 bits of entropy in
// the emailed link, only the SHA-256 digest persisted, short TTL, single use.

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000

export function generateLoginToken (): string {
  return randomBytes(32).toString('base64url')
}

export function hashLoginToken (token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function loginTokenExpiry (now: Date = new Date()): string {
  return new Date(now.getTime() + LOGIN_TOKEN_TTL_MS).toISOString()
}

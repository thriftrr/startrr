import type { H3Event } from 'h3'
import { SignJWT, jwtVerify } from 'jose'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { APP_NAME, APP_SLUG } from '#shared/app'
import type { PasskeyList, PasskeySummary } from '#shared/types/passkey'

// Passkeys, server side, on top of @simplewebauthn/server.
//
// Every ceremony is two requests: options (a fresh challenge) and verify
// (the authenticator's signature over it). Rather than store the challenge
// in between, options hands it out inside a token signed with the session
// secret, so merely showing the sign-in page writes nothing. Verify checks
// the token, then records the challenge as spent in D1 — the same response
// sent twice finds it already taken.

const CHALLENGE_TTL_SECONDS = 10 * 60

// A passkey stands in for the magic link, which proves possession of an
// inbox, not a PIN. So user verification is asked for but not demanded:
// requiring it would turn away security keys without one for no gain over
// the email path.
export const PASSKEY_USER_VERIFICATION = 'preferred' as const

type Ceremony = 'register' | 'login'

// WebAuthn binds a passkey to a domain (the RP ID) and checks every response
// against the exact origin, so both come from the pinned public origin — a
// spoofed Host header can't mint passkeys for somewhere else.
export function relyingParty (event: H3Event) {
  const origin = publicOrigin(event)
  return { origin, rpID: new URL(origin).hostname, rpName: APP_NAME }
}

// The WebAuthn user handle: the account id's bytes. Stable, so a device that
// already holds a passkey for the account is recognised, and free of the
// email address, as the spec asks.
export function userHandleBytes (userId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(userId)
}

export function userHandleOf (userId: string): string {
  return isoBase64URL.fromUTF8String(userId)
}

export async function issueChallengeToken (ceremony: Ceremony, challenge: string, userId?: string): Promise<string> {
  const token = new SignJWT({ chal: challenge })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(`${APP_SLUG}:passkey-${ceremony}`)
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
  if (userId) token.setSubject(userId)
  return await token.sign(sessionSecret())
}

// Returns the challenge a token vouches for, exactly once. A registration
// token is also bound to the account that asked for it.
export async function spendChallengeToken (token: unknown, ceremony: Ceremony, userId?: string): Promise<string> {
  const stale = createError({ statusCode: 400, statusMessage: 'That passkey request expired — try again.' })
  if (typeof token !== 'string' || !token || token.length > 2048) throw stale

  let payload: { chal?: unknown, sub?: unknown, exp?: unknown }
  try {
    ({ payload } = await jwtVerify(token, sessionSecret(), { audience: `${APP_SLUG}:passkey-${ceremony}` }))
  } catch {
    throw stale
  }
  if (typeof payload.chal !== 'string' || typeof payload.exp !== 'number') throw stale
  if (userId && payload.sub !== userId) throw stale

  if (!await spendPasskeyChallenge(payload.chal, new Date(payload.exp * 1000).toISOString())) throw stale
  return payload.chal
}

// The browser's credential JSON, checked for shape before the library digs
// into it. Null means it isn't one; the library validates the rest.
export function readCredentialResponse<T extends { id: string }> (value: unknown): T | null {
  if (!value || typeof value !== 'object') return null
  const { id, type, response } = value as { id?: unknown, type?: unknown, response?: unknown }
  // Credential ids are at most 1023 bytes — 1364 characters of base64url.
  if (typeof id !== 'string' || !id || id.length > 1364 || !/^[A-Za-z0-9_-]+$/.test(id)) return null
  if (type !== 'public-key' || !response || typeof response !== 'object') return null
  return value as T
}

export function splitTransports (transports: string): string[] {
  return transports.split(',').filter(Boolean)
}

// Names for the passkey providers people actually use, by AAGUID, from the
// community list at github.com/passkeydeveloper/passkey-authenticator-aaguids.
// For anything else, the browser it was added from has to say enough.
const PROVIDERS: Record<string, string> = {
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'Apple Passwords',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'Apple Passwords',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'd3452668-01fd-4c12-926c-83a4204853aa': 'Microsoft Password Manager',
  '53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
  '50726f74-6f6e-5061-7373-50726f746f6e': 'Proton Pass',
  'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'NordPass',
  '0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6': 'Keeper',
  'f3809540-7f14-49c1-a8b3-8f813b225541': 'Enpass',
  'fdb141b2-5d84-443e-8a35-4698c205a502': 'KeePassXC'
}

export function passkeyProviderName (aaguid: string): string | null {
  return PROVIDERS[aaguid.toLowerCase()] ?? null
}

export async function passkeyListFor (event: H3Event, userId: string): Promise<PasskeyList> {
  const rows = await listUserPasskeys(userId)
  const passkeys: PasskeySummary[] = rows.map(row => ({
    id: row.id,
    provider: passkeyProviderName(row.aaguid),
    synced: row.backedUp,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt
  }))
  return { passkeys, rpID: relyingParty(event).rpID, userHandle: userHandleOf(userId) }
}

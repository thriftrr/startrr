import { describe, expect, it } from 'vitest'
import { LOGIN_TOKEN_TTL_MS, generateLoginToken, hashLoginToken, loginTokenExpiry } from '../../server/utils/magic-links'

describe('magic-link tokens', () => {
  it('are 256-bit, URL-safe, and unique', () => {
    const a = generateLoginToken()
    const b = generateLoginToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })

  it('hash deterministically to a hex SHA-256 digest', () => {
    const token = generateLoginToken()
    expect(hashLoginToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashLoginToken(token)).toBe(hashLoginToken(token))
    expect(hashLoginToken(token)).not.toBe(hashLoginToken(generateLoginToken()))
  })

  it('expire 15 minutes out', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(LOGIN_TOKEN_TTL_MS).toBe(15 * 60 * 1000)
    expect(loginTokenExpiry(now)).toBe('2026-01-01T00:15:00.000Z')
  })
})

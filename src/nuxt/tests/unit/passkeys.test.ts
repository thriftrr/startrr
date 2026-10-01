import { describe, expect, it } from 'vitest'
import { passkeyProviderName, readCredentialResponse, splitTransports, userHandleBytes, userHandleOf } from '../../server/utils/passkeys'

describe('passkey helpers', () => {
  it('accept only credential-shaped responses', () => {
    const ok = { id: 'AbC-_9', type: 'public-key', response: {} }
    expect(readCredentialResponse(ok)).toBe(ok)
    expect(readCredentialResponse(null)).toBeNull()
    expect(readCredentialResponse('nope')).toBeNull()
    expect(readCredentialResponse({ ...ok, id: '' })).toBeNull()
    expect(readCredentialResponse({ ...ok, id: 'not base64url!' })).toBeNull()
    expect(readCredentialResponse({ ...ok, id: 'a'.repeat(1365) })).toBeNull()
    expect(readCredentialResponse({ ...ok, type: 'password' })).toBeNull()
    expect(readCredentialResponse({ ...ok, response: undefined })).toBeNull()
  })

  it('name the providers people use, and nothing else', () => {
    expect(passkeyProviderName('fbfc3007-154e-4ecc-8c0b-6e020557d7bd')).toBe('Apple Passwords')
    expect(passkeyProviderName('BADA5566-A7AA-401F-BD96-45619A55120D')).toBe('1Password')
    expect(passkeyProviderName('00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(passkeyProviderName('')).toBeNull()
  })

  it('derive the user handle from the account id, the same way twice', () => {
    const id = '7f1c2a9e-3b4d-4e5f-8a6b-9c0d1e2f3a4b'
    expect(Buffer.from(userHandleBytes(id)).toString('base64url')).toBe(userHandleOf(id))
    expect(userHandleOf(id)).not.toContain('@')
  })

  it('round-trip transports through their column', () => {
    expect(splitTransports('internal,hybrid')).toEqual(['internal', 'hybrid'])
    expect(splitTransports('')).toEqual([])
  })
})

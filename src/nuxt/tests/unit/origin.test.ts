import { describe, expect, it } from 'vitest'
import { isRequestAllowed } from '../../server/utils/origin'

const APP = 'https://app.example.com'
const base = { path: '/api/account/profile', expectedOrigin: APP, hasCookie: true }

describe('isRequestAllowed (CSRF guard)', () => {
  it('lets safe methods and non-API paths through', () => {
    expect(isRequestAllowed({ ...base, method: 'GET', origin: 'https://evil.example', fetchSite: 'cross-site' })).toBe(true)
    expect(isRequestAllowed({ ...base, method: 'POST', path: '/login', origin: 'https://evil.example', fetchSite: 'cross-site' })).toBe(true)
  })

  it('requires a matching Origin when one is sent', () => {
    expect(isRequestAllowed({ ...base, method: 'POST', origin: APP, fetchSite: 'same-origin' })).toBe(true)
    expect(isRequestAllowed({ ...base, method: 'POST', origin: APP, fetchSite: undefined, expectedOrigin: `${APP}/` })).toBe(true)
    expect(isRequestAllowed({ ...base, method: 'POST', origin: 'https://evil.example', fetchSite: 'cross-site' })).toBe(false)
    expect(isRequestAllowed({ ...base, method: 'PATCH', origin: 'null', fetchSite: undefined })).toBe(false)
  })

  it('falls back to Sec-Fetch-Site without an Origin', () => {
    expect(isRequestAllowed({ ...base, method: 'DELETE', origin: undefined, fetchSite: 'same-origin' })).toBe(true)
    expect(isRequestAllowed({ ...base, method: 'DELETE', origin: undefined, fetchSite: 'none' })).toBe(true)
    expect(isRequestAllowed({ ...base, method: 'DELETE', origin: undefined, fetchSite: 'cross-site' })).toBe(false)
    expect(isRequestAllowed({ ...base, method: 'DELETE', origin: undefined, fetchSite: 'same-site' })).toBe(false)
  })

  it('allows header-less clients only when there is no cookie to forge', () => {
    expect(isRequestAllowed({ ...base, method: 'POST', origin: undefined, fetchSite: undefined, hasCookie: false })).toBe(true)
    expect(isRequestAllowed({ ...base, method: 'POST', origin: undefined, fetchSite: undefined, hasCookie: true })).toBe(false)
  })
})

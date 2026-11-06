import { describe, expect, it } from 'vitest'
import { isServerPath, safeRedirectPath } from '../../shared/utils/redirect'

describe('post-sign-in destinations', () => {
  it('stay on this origin', () => {
    expect(safeRedirectPath('/account?tab=x')).toBe('/account?tab=x')
    expect(safeRedirectPath('//evil.example')).toBe('')
    expect(safeRedirectPath('/\\evil.example')).toBe('')
    expect(safeRedirectPath('https://evil.example')).toBe('')
    // Browsers drop tabs and newlines from URLs: these are //evil.example.
    expect(safeRedirectPath('/\t/evil.example')).toBe('')
    expect(safeRedirectPath('/\n/evil.example')).toBe('')
    expect(safeRedirectPath('/\r\n/evil.example')).toBe('')
    expect(safeRedirectPath('/ /evil.example')).toBe('')
    expect(safeRedirectPath('/%09/evil.example')).toBe('/%09/evil.example')
  })

  it('know which ones the client router cannot reach', () => {
    expect(isServerPath('/oauth/authorize?x')).toBe(true)
    expect(isServerPath('/account')).toBe(false)
  })
})

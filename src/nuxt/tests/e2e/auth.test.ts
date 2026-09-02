import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, fetch, setup, url } from '@nuxt/test-utils/e2e'

// Boots the real dev server (local sqlite/KV under .data, console email
// transport) and walks the whole sign-in story: request a link, spend it,
// prove it can't be spent twice, prove the session cookie is bound to a
// same-origin browser, then sign out and prove the cookie is dead.
describe('passwordless sign-in', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    dev: true,
    // Keep test users out of the dev database.
    nuxtConfig: { hub: { dir: '.data/test' } }
  })

  const json = { 'content-type': 'application/json' }

  it('issues a single-use magic link and a revocable session', async () => {
    const email = `e2e-${Date.now()}@example.com`
    const origin = new URL(url('/')).origin

    // 1. Ask for a link. In dev the response carries it (no inbox to read).
    const login = await $fetch<{ ok: boolean, devLink?: string }>('/api/auth/login', {
      method: 'POST',
      body: { email }
    })
    expect(login.ok).toBe(true)
    const token = new URL(login.devLink ?? '').searchParams.get('token')
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)

    // 2. Spend it: a session cookie comes back.
    const verify = await fetch('/api/auth/verify', { method: 'POST', headers: json, body: JSON.stringify({ token }) })
    expect(verify.status).toBe(200)
    const cookie = (verify.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    expect(cookie).toMatch(/^startrr_session=/)

    // 3. The same token is worthless now.
    const again = await fetch('/api/auth/verify', { method: 'POST', headers: json, body: JSON.stringify({ token }) })
    expect(again.status).toBe(400)

    // 4. The cookie identifies the account.
    const me = await $fetch<{ user: { email: string } | null }>('/api/auth/me', { headers: { cookie } })
    expect(me.user?.email).toBe(email)

    // 5. Writes need a same-origin browser: a foreign Origin, or a cookie
    //    with no browser headers at all, is refused.
    const forged = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { ...json, cookie, origin: 'https://evil.example' },
      body: JSON.stringify({ firstName: 'Mallory' })
    })
    expect(forged.status).toBe(403)
    const headless = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { ...json, cookie },
      body: JSON.stringify({ firstName: 'Mallory' })
    })
    expect(headless.status).toBe(403)
    const legit = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { ...json, cookie, origin },
      body: JSON.stringify({ firstName: 'Alice' })
    })
    expect(legit.status).toBe(200)
    const named = await $fetch<{ user: { firstName: string | null } | null }>('/api/auth/me', { headers: { cookie } })
    expect(named.user?.firstName).toBe('Alice')

    // 6. The session shows up in the list, and only this one.
    const list = await $fetch<{ sessions: { current: boolean }[] }>('/api/auth/sessions', { headers: { cookie } })
    expect(list.sessions).toHaveLength(1)
    expect(list.sessions[0]?.current).toBe(true)

    // 7. Sign out revokes the row: the very same cookie is now anonymous.
    const out = await fetch('/api/auth/logout', { method: 'POST', headers: { cookie, origin } })
    expect(out.status).toBe(200)
    const after = await $fetch<{ user: unknown }>('/api/auth/me', { headers: { cookie } })
    expect(after.user).toBeNull()
  })

  it('rejects junk', async () => {
    const bad = await fetch('/api/auth/login', { method: 'POST', headers: json, body: JSON.stringify({ email: 'nope' }) })
    expect(bad.status).toBe(400)
    const missing = await fetch('/api/auth/verify', { method: 'POST', headers: json, body: '{}' })
    expect(missing.status).toBe(400)
    const anon = await fetch('/api/scratch')
    expect(anon.status).toBe(401)
  })

  it('sends hardening headers', async () => {
    const res = await fetch('/login')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })
})

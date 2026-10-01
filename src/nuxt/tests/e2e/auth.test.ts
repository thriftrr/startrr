import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, fetch, setup, url } from '@nuxt/test-utils/e2e'
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server'
import type { PasskeyList } from '../../shared/types/passkey'
import { createPasskey, usePasskey } from './soft-authenticator'

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

  // Signs a fresh account in by magic link; returns its session cookie and
  // what the verifier said about its passkeys.
  async function signIn (email: string) {
    const login = await $fetch<{ devLink?: string }>('/api/auth/login', { method: 'POST', body: { email } })
    const token = new URL(login.devLink ?? '').searchParams.get('token')
    const verify = await fetch('/api/auth/verify', { method: 'POST', headers: json, body: JSON.stringify({ token }) })
    expect(verify.status).toBe(200)
    const cookie = (verify.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    const { passkeys } = await verify.json() as { passkeys: number }
    return { cookie, passkeys }
  }

  async function post (path: string, body: unknown, headers: Record<string, string> = {}) {
    const origin = new URL(url('/')).origin
    return await fetch(path, { method: 'POST', headers: { ...json, origin, ...headers }, body: JSON.stringify(body) })
  }

  type Ceremony<T> = { options: T, challengeToken: string }

  it('adds a passkey after email sign-in, then signs in with it alone', async () => {
    const email = `passkey-${Date.now()}@example.com`
    const origin = new URL(url('/')).origin

    // 1. Email first: a passkey can only be added to a signed-in account.
    const { cookie, passkeys } = await signIn(email)
    expect(passkeys).toBe(0)
    expect((await post('/api/account/passkeys/options', {})).status).toBe(401)

    // 2. Registration options name the account and ask for a discoverable key.
    const reg = await (await post('/api/account/passkeys/options', {}, { cookie })).json() as Ceremony<PublicKeyCredentialCreationOptionsJSON>
    expect(reg.options.rp.id).toBe(new URL(origin).hostname)
    expect(reg.options.user.name).toBe(email)
    expect(reg.options.authenticatorSelection?.residentKey).toBe('required')

    // 3. The authenticator answers; the server stores the key and lists it.
    const { passkey, response } = await createPasskey(reg.options, origin)
    const added = await post('/api/account/passkeys', { response, challengeToken: reg.challengeToken }, { cookie })
    expect(added.status).toBe(200)
    const list = await added.json() as PasskeyList
    expect(list.passkeys).toHaveLength(1)
    expect(list.passkeys[0]).toMatchObject({ id: passkey.id, provider: 'Apple Passwords', synced: true, lastUsedAt: null })

    // 4. The same answer twice is refused: the challenge is spent.
    const again = await post('/api/account/passkeys', { response, challengeToken: reg.challengeToken }, { cookie })
    expect(again.status).toBe(400)

    // 5. The next magic link knows the account has one.
    expect((await signIn(email)).passkeys).toBe(1)

    // 6. Sign in with the passkey alone — no email, no cookie.
    const auth = await (await post('/api/auth/passkey/options', {})).json() as Ceremony<PublicKeyCredentialRequestOptionsJSON>
    expect(auth.options.allowCredentials ?? []).toHaveLength(0)
    const assertion = await usePasskey(passkey, auth.options, origin)
    const signedIn = await post('/api/auth/passkey/verify', { response: assertion, challengeToken: auth.challengeToken })
    expect(signedIn.status).toBe(200)
    const session = (signedIn.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    expect(session).toMatch(/^startrr_session=/)
    const me = await $fetch<{ user: { email: string } | null }>('/api/auth/me', { headers: { cookie: session } })
    expect(me.user?.email).toBe(email)

    // 7. A replayed sign-in is refused.
    const replay = await post('/api/auth/passkey/verify', { response: assertion, challengeToken: auth.challengeToken })
    expect(replay.status).toBe(400)

    // 8. A signature made for another site is refused (phishing).
    const phish = await (await post('/api/auth/passkey/options', {})).json() as Ceremony<PublicKeyCredentialRequestOptionsJSON>
    const phished = await usePasskey(passkey, phish.options, 'https://evil.example')
    expect((await post('/api/auth/passkey/verify', { response: phished, challengeToken: phish.challengeToken })).status).toBe(400)

    // 9. A counter that goes backwards means a cloned key: refused.
    const clone = await (await post('/api/auth/passkey/options', {})).json() as Ceremony<PublicKeyCredentialRequestOptionsJSON>
    const cloned = await usePasskey(passkey, clone.options, origin, 0)
    expect((await post('/api/auth/passkey/verify', { response: cloned, challengeToken: clone.challengeToken })).status).toBe(400)

    // 10. The account page shows it was used.
    const used = await $fetch<PasskeyList>('/api/account/passkeys', { headers: { cookie } })
    expect(used.passkeys[0]?.lastUsedAt).toBeTruthy()

    // 11. Remove it: the list empties, and the passkey no longer signs in —
    //     with a flag so the page can ask the browser to forget it.
    const removed = await fetch(`/api/account/passkeys/${passkey.id}`, { method: 'DELETE', headers: { cookie, origin } })
    expect(removed.status).toBe(200)
    expect((await removed.json() as PasskeyList).passkeys).toHaveLength(0)
    const gone = await (await post('/api/auth/passkey/options', {})).json() as Ceremony<PublicKeyCredentialRequestOptionsJSON>
    const stale = await post('/api/auth/passkey/verify', { response: await usePasskey(passkey, gone.options, origin), challengeToken: gone.challengeToken })
    expect(stale.status).toBe(400)
    expect((await stale.json() as { data?: { unknownCredential?: boolean } }).data?.unknownCredential).toBe(true)

    // 12. The email link still works with no passkeys left.
    expect((await signIn(email)).cookie).toMatch(/^startrr_session=/)
  })

  it('keeps passkeys and their challenges to the account that owns them', async () => {
    const origin = new URL(url('/')).origin
    const alice = await signIn(`alice-${Date.now()}@example.com`)
    const mallory = await signIn(`mallory-${Date.now()}@example.com`)

    // Mallory can't finish a registration Alice started…
    const reg = await (await post('/api/account/passkeys/options', {}, { cookie: alice.cookie })).json() as Ceremony<PublicKeyCredentialCreationOptionsJSON>
    const { passkey, response } = await createPasskey(reg.options, origin)
    expect((await post('/api/account/passkeys', { response, challengeToken: reg.challengeToken }, { cookie: mallory.cookie })).status).toBe(400)

    // …nor pass off a sign-in challenge as a registration one.
    const login = await (await post('/api/auth/passkey/options', {})).json() as Ceremony<PublicKeyCredentialRequestOptionsJSON>
    expect((await post('/api/account/passkeys', { response, challengeToken: login.challengeToken }, { cookie: alice.cookie })).status).toBe(400)

    // Alice finishes it with a fresh challenge.
    const fresh = await (await post('/api/account/passkeys/options', {}, { cookie: alice.cookie })).json() as Ceremony<PublicKeyCredentialCreationOptionsJSON>
    const mine = await createPasskey(fresh.options, origin)
    expect((await post('/api/account/passkeys', { response: mine.response, challengeToken: fresh.challengeToken }, { cookie: alice.cookie })).status).toBe(200)
    expect(passkey.id).not.toBe(mine.passkey.id)

    // Mallory can't see or remove it.
    const theirs = await $fetch<PasskeyList>('/api/account/passkeys', { headers: { cookie: mallory.cookie } })
    expect(theirs.passkeys).toHaveLength(0)
    const steal = await fetch(`/api/account/passkeys/${mine.passkey.id}`, { method: 'DELETE', headers: { cookie: mallory.cookie, origin } })
    expect(steal.status).toBe(404)

    // A passkey that claims to belong to someone else is refused.
    const auth = await (await post('/api/auth/passkey/options', {})).json() as Ceremony<PublicKeyCredentialRequestOptionsJSON>
    const forged = await usePasskey({ ...mine.passkey, userHandle: Buffer.from('someone-else').toString('base64url') }, auth.options, origin)
    expect((await post('/api/auth/passkey/verify', { response: forged, challengeToken: auth.challengeToken })).status).toBe(400)
  })

  it('rejects junk', async () => {
    const bad = await fetch('/api/auth/login', { method: 'POST', headers: json, body: JSON.stringify({ email: 'nope' }) })
    expect(bad.status).toBe(400)
    const missing = await fetch('/api/auth/verify', { method: 'POST', headers: json, body: '{}' })
    expect(missing.status).toBe(400)
    const anon = await fetch('/api/scratch')
    expect(anon.status).toBe(401)
    const noPasskey = await fetch('/api/auth/passkey/verify', { method: 'POST', headers: json, body: JSON.stringify({ response: { id: 'x' } }) })
    expect(noPasskey.status).toBe(400)
    const noToken = await fetch('/api/auth/passkey/verify', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ response: { id: 'abc', type: 'public-key', response: {} }, challengeToken: 'forged' })
    })
    expect(noToken.status).toBe(400)
  })

  it('sends hardening headers', async () => {
    const res = await fetch('/login')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })
})

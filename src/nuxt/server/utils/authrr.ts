import type { H3Event } from 'h3'
import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, createLocalJWKSet, jwtVerify } from 'jose'
import type { JSONWebKeySet } from 'jose'
import { APP_SLUG } from '#shared/app'
import { isPaletteId } from '#shared/types/palette'

// Sign-in through Authrr, the thriftrr identity provider (OpenID Connect).
//
// Off unless NUXT_AUTHRR_ISSUER is set; then this app's own magic links and
// passkeys switch off and /login sends people to Authrr instead. The app
// still keeps its own sessions (session.ts) — Authrr only vouches for who
// someone is at sign-in, and is asked again whenever a session is refreshed
// (at most hourly), so a ban there reaches here without a 30-day wait.

export interface AuthrrConfig {
  issuer: string
  clientId: string
  clientSecret: string
}

export function authrrEnabled (): boolean {
  return Boolean(useRuntimeConfig().public.authrrIssuer)
}

export function authrrConfig (): AuthrrConfig {
  const { authrrClientId, authrrClientSecret, public: { authrrIssuer } } = useRuntimeConfig()
  if (!authrrIssuer) throw createError({ statusCode: 404, statusMessage: 'Sign-in through Authrr is not set up here' })
  if (!authrrClientId || !authrrClientSecret) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_AUTHRR_CLIENT_ID and NUXT_AUTHRR_CLIENT_SECRET are required with NUXT_AUTHRR_ISSUER' })
  }
  return { issuer: String(authrrIssuer).replace(/\/$/, ''), clientId: String(authrrClientId), clientSecret: String(authrrClientSecret) }
}

// For the handlers that only make sense when this app runs its own
// accounts: magic links, passkeys, editing the name and photo Authrr owns.
export function assertLocalAccounts () {
  if (authrrEnabled()) {
    throw createError({ statusCode: 404, statusMessage: 'Accounts here are managed by Authrr' })
  }
}

// ---- Talking to Authrr -------------------------------------------------------

// On Cloudflare, a Worker can't always fetch another Worker's custom domain
// in the same zone, so when an AUTHRR service binding exists (see
// NUXT_CF_AUTHRR_SERVICE) requests go through it — no public hop at all.
// Everywhere else (dev, tests, other hosts) it's a plain fetch.
async function authrrFetch (event: H3Event | undefined, path: string, init?: RequestInit): Promise<Response> {
  const url = `${authrrConfig().issuer}${path}`
  const binding = (event?.context as { cloudflare?: { env?: { AUTHRR?: { fetch: typeof fetch } } } } | undefined)?.cloudflare?.env?.AUTHRR
  if (binding) return await binding.fetch(url, init)
  return await fetch(url, init)
}

// A client-authenticated call to Authrr's API (its settings routes), as
// JSON. Authrr's refusal comes through with its own words.
export async function authrrApi<T> (event: H3Event, path: string, init: { method?: string, body?: BodyInit, json?: unknown, contentType?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { authorization: basicAuth() }
  let body = init.body
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(init.json)
  } else if (init.contentType) {
    headers['content-type'] = init.contentType
  }
  let res: Response
  try {
    res = await authrrFetch(event, path, { method: init.method ?? 'POST', headers, body })
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Could not reach Authrr. Try again in a moment.' })
  }
  const data = await res.json().catch(() => null) as (T & { statusMessage?: string }) | null
  if (!res.ok || !data) {
    throw createError({ statusCode: res.status >= 500 || !data ? 502 : res.status, statusMessage: data?.statusMessage ?? 'Authrr refused that' })
  }
  return data
}

function basicAuth (): string {
  const { clientId, clientSecret } = authrrConfig()
  return `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64')}`
}

// The public signing keys, refetched every ten minutes or when a token
// names a key we haven't seen (Authrr rotated).
let keys: { set: ReturnType<typeof createLocalJWKSet>, kids: Set<string>, at: number } | null = null
const KEYS_TTL_MS = 10 * 60 * 1000

async function authrrKeys (event: H3Event, kid: string | undefined) {
  const stale = !keys || Date.now() - keys.at > KEYS_TTL_MS || (kid && !keys.kids.has(kid))
  if (stale) {
    const res = await authrrFetch(event, '/oauth/jwks')
    if (!res.ok) throw new AuthrrLoginError('unreachable')
    const jwks = await res.json() as JSONWebKeySet
    keys = { set: createLocalJWKSet(jwks), kids: new Set(jwks.keys.map(k => k.kid).filter((k): k is string => Boolean(k))), at: Date.now() }
  }
  return keys!.set
}

// ---- The sign-in round trip ------------------------------------------------

// A failure the person should see on the sign-in page; the words for each
// code are in shared/utils/authrr-errors.ts.
export class AuthrrLoginError extends Error {
  // Set once the state cookie is read: whether this sign-in ran in a popup.
  popup = false
  constructor (readonly code: AuthrrErrorCode) {
    super(AUTHRR_ERRORS[code])
  }
}

const STATE_COOKIE = `${APP_SLUG}_authrr`
const STATE_TTL_SECONDS = 10 * 60
const STATE_AUDIENCE = `${APP_SLUG}:authrr-login`
const COOKIE_PATH = '/auth/authrr'

export function authrrCallbackUri (event: H3Event): string {
  return `${publicOrigin(event)}${COOKIE_PATH}/callback`
}

// Builds the Authrr authorize URL. The state, PKCE verifier and nonce ride
// in a short-lived signed cookie rather than a table, so starting a sign-in
// writes nothing; the cookie is SameSite=Lax, which is sent on the
// top-level redirect back from Authrr.
// `popup`: the sign-in runs in a small window over the page (the default
// from /login), and the callback hands off to /auth/popup-done instead of
// navigating; see app/utils/authrr-popup.ts.
export async function startAuthrrLogin (event: H3Event, redirect: string, popup = false): Promise<string> {
  const { issuer, clientId } = authrrConfig()
  const state = randomBytes(16).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const nonce = randomBytes(16).toString('base64url')

  const token = await new SignJWT({ state, verifier, nonce, redirect, popup })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(STATE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(sessionSecret())
  setCookie(event, STATE_COOKIE, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    maxAge: STATE_TTL_SECONDS,
    path: COOKIE_PATH
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: authrrCallbackUri(event),
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256'
  })
  return `${issuer}/oauth/authorize?${params}`
}

export interface AuthrrClaims {
  sub: string
  email: string
  given_name?: string
  family_name?: string
  picture?: string
  palette?: string
  role: 'admin' | 'member'
}

function readClaims (value: Record<string, unknown>): AuthrrClaims | null {
  if (typeof value.sub !== 'string' || !value.sub || typeof value.email !== 'string' || !value.email) return null
  const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : undefined
  // Only Authrr's own avatar URLs, never an arbitrary host in an <img>.
  const picture = typeof value.picture === 'string' && value.picture.startsWith(`${authrrConfig().issuer}/`) ? value.picture : undefined
  return {
    sub: value.sub,
    email: value.email.trim().toLowerCase(),
    given_name: text(value.given_name),
    family_name: text(value.family_name),
    picture,
    palette: typeof value.palette === 'string' ? value.palette : undefined,
    role: value.role === 'admin' ? 'admin' : 'member'
  }
}

// The callback: checks the state against the cookie, swaps the code for an
// ID token, and verifies it. Returns who signed in and where they were
// headed.
export async function finishAuthrrLogin (event: H3Event): Promise<{ claims: AuthrrClaims, redirect: string, popup: boolean }> {
  const { issuer, clientId } = authrrConfig()
  const query = getQuery(event)

  const raw = getCookie(event, STATE_COOKIE)
  deleteCookie(event, STATE_COOKIE, { path: COOKIE_PATH })
  let saved: { state?: unknown, verifier?: unknown, nonce?: unknown, redirect?: unknown, popup?: unknown }
  try {
    if (!raw) throw new Error('no cookie')
    ;({ payload: saved } = await jwtVerify(raw, sessionSecret(), { audience: STATE_AUDIENCE }))
  } catch {
    throw new AuthrrLoginError('expired')
  }
  // From here on the cookie is ours, so a failure knows whether it was a
  // popup's and can be handed back to the page that opened it.
  const popup = saved.popup === true
  try {
    if (typeof saved.state !== 'string' || query.state !== saved.state) {
      throw new AuthrrLoginError('mismatch')
    }
    // RFC 9207: the response says who sent it, and it has to be our issuer.
    if (query.iss !== undefined && query.iss !== issuer) {
      throw new AuthrrLoginError('wrong-issuer')
    }
    if (typeof query.error === 'string') {
      if (query.error === 'access_denied') throw new AuthrrLoginError('denied')
      throw new AuthrrLoginError('failed')
    }
    const code = query.code
    if (typeof code !== 'string' || !code || code.length > 128) throw new AuthrrLoginError('failed')

    const res = await authrrFetch(event, '/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'authorization': basicAuth() },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: authrrCallbackUri(event),
        code_verifier: String(saved.verifier)
      }).toString()
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (body.error === 'access_denied') throw new AuthrrLoginError('denied')
      if (body.error === 'invalid_client') throw new AuthrrLoginError('bad-client')
      throw new AuthrrLoginError('failed')
    }
    const { id_token: idToken } = await res.json() as { id_token?: string }
    if (!idToken) throw new AuthrrLoginError('bad-token')

    let payload: Record<string, unknown>
    try {
      const kid = JSON.parse(Buffer.from(idToken.split('.')[0] ?? '', 'base64url').toString('utf8')).kid as string | undefined
      ;({ payload } = await jwtVerify(idToken, await authrrKeys(event, kid), { issuer, audience: clientId, algorithms: ['ES256'] }))
    } catch (cause) {
      if (cause instanceof AuthrrLoginError) throw cause
      throw new AuthrrLoginError('bad-token')
    }
    if (payload.nonce !== saved.nonce) throw new AuthrrLoginError('bad-token')

    const claims = readClaims(payload)
    if (!claims) throw new AuthrrLoginError('bad-token')
    return { claims, redirect: safeRedirectPath(saved.redirect), popup }
  } catch (cause) {
    if (cause instanceof AuthrrLoginError) cause.popup = popup
    throw cause
  }
}

// ---- Local accounts --------------------------------------------------------

// Finds (or makes) the local account for an Authrr identity and brings its
// copy of the profile up to date. Linked by `sub`; the first time, an
// existing local account with the same (Authrr-verified) email is adopted,
// so switching an app to Authrr keeps everyone's data.
export async function syncAuthrrUser (claims: AuthrrClaims): Promise<DbUser> {
  const profile = {
    firstName: claims.given_name ?? null,
    lastName: claims.family_name ?? null,
    pictureUrl: claims.picture ?? null,
    // A palette this app doesn't have falls back to its default.
    palette: isPaletteId(claims.palette) ? claims.palette : null,
    role: claims.role
  }

  const linked = await getUserByAuthrrSub(claims.sub)
  if (linked) {
    // Follow an email change, unless another local account holds it.
    const taken = linked.email !== claims.email && await getUserByEmail(claims.email)
    const email = taken ? linked.email : claims.email
    await applyAuthrrProfile(linked.id, { email, ...profile })
    return { ...linked, email, ...profile }
  }

  const user = await ensureUser(claims.email)
  if (user.authrrSub && user.authrrSub !== claims.sub) {
    throw new AuthrrLoginError('linked-elsewhere')
  }
  await applyAuthrrProfile(user.id, { authrrSub: claims.sub, ...profile })
  return { ...user, authrrSub: claims.sub, ...profile }
}

// Asked when a session is refreshed: true to keep it, false to end it.
// If Authrr can't be reached the session stands — an outage there
// shouldn't sign everyone out here — and the question is asked again on
// the next request.
export async function authrrStillAllows (event: H3Event, userId: string): Promise<boolean | 'unknown'> {
  const user = await getUserById(userId)
  // A local session from before the switch to Authrr: sign in again.
  if (!user?.authrrSub) return false

  let res: Response
  try {
    res = await authrrFetch(event, '/oauth/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': basicAuth() },
      body: JSON.stringify({ sub: user.authrrSub })
    })
  } catch {
    return 'unknown'
  }
  if (!res.ok) return 'unknown'
  const body = await res.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return 'unknown'
  if (body.active !== true) return false
  const claims = readClaims(body)
  if (claims && claims.sub === user.authrrSub) await syncAuthrrUser(claims)
  return true
}

// Where "Sign out" goes: through Authrr's logout, so the next sign-in here
// actually asks, then back to this app's sign-in page.
export function authrrLogoutUrl (event: H3Event): string {
  const { issuer, clientId } = authrrConfig()
  const params = new URLSearchParams({
    client_id: clientId,
    post_logout_redirect_uri: `${publicOrigin(event)}/login?signedOut=1`
  })
  return `${issuer}/oauth/logout?${params}`
}

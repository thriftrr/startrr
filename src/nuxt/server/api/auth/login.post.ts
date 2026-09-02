const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, turnstile?: string }>(event)
  const email = body?.email?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    throw createError({ statusCode: 400, statusMessage: 'A valid email is required' })
  }

  // Every request here sends a real email, so this is the endpoint worth
  // throttling hardest: one send per address per minute, a daily cap per
  // address, and an hourly cap per IP against broad spraying.
  await assertRateLimit([
    { key: `login-email:${email}`, limit: 1, windowSeconds: 60 },
    { key: `login-email-day:${email}`, limit: 8, windowSeconds: 86_400 },
    { key: `login-ip:${clientIp(event)}`, limit: 30, windowSeconds: 3_600 }
  ])

  // Bot check, when configured (no-op otherwise).
  await assertTurnstile(event, body?.turnstile)

  const token = generateLoginToken()
  await insertLoginToken(hashLoginToken(token), email, loginTokenExpiry())

  // The link's origin is pinned by NUXT_APP_ORIGIN in production: deriving it
  // from the request would let a spoofed Host header (behind a plain reverse
  // proxy) mail out a live token pointing at an attacker's domain.
  const config = useRuntimeConfig()
  if (!config.appOrigin && !import.meta.dev) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_APP_ORIGIN is not set' })
  }
  const origin = (config.appOrigin || getRequestURL(event).origin).replace(/\/$/, '')
  const link = `${origin}/auth/verify?token=${token}`

  const message = magicLinkEmail({
    link,
    expiresMinutes: Math.round(LOGIN_TOKEN_TTL_MS / 60_000),
    email
  })

  await sendEmail(event, { to: email, ...message })

  // In dev the console transport is the outbox; surfacing the link in the
  // response makes local testing painless. Never included in production.
  return { ok: true, ...(import.meta.dev ? { devLink: link } : {}) }
})

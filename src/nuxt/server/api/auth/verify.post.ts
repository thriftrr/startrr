export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string }>(event)
  const token = body?.token
  if (typeof token !== 'string' || !token || token.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'Missing token' })
  }

  // Tokens are 256-bit and single-use, so guessing is hopeless anyway — this
  // just keeps someone from hammering the endpoint for free.
  await assertRateLimit([{ key: `verify-ip:${clientIp(event)}`, limit: 30, windowSeconds: 600 }])

  const email = await spendLoginToken(hashLoginToken(token))
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'This sign-in link is invalid or has expired. Request a new one.' })
  }

  const user = await ensureUser(email)
  await startSession(event, { id: user.id, email: user.email })
  return { user: { email: user.email } }
})

// Back from Authrr. Anything that goes wrong lands on /login with a reason
// code (shared/utils/authrr-errors.ts), where the person can try again —
// never a bare error page in the middle of a sign-in.
export default defineEventHandler(async (event) => {
  await assertRateLimit([{ key: `authrr-callback-ip:${clientIp(event)}`, limit: 60, windowSeconds: 600 }])
  let next: string
  try {
    const { claims, redirect } = await finishAuthrrLogin(event)
    const user = await syncAuthrrUser(claims)
    await startSession(event, { id: user.id, email: user.email })
    next = redirect || '/'
  } catch (cause) {
    // ensureUser's 503 is the one error worth naming that isn't ours.
    const code = cause instanceof AuthrrLoginError
      ? cause.code
      : (cause as { statusCode?: number }).statusCode === 503 ? 'full' : 'failed'
    if (!(cause instanceof AuthrrLoginError)) console.error('[authrr] sign-in failed', cause)
    next = `/login?${new URLSearchParams({ error: code })}`
  }
  return sendRedirect(event, next, 302)
})

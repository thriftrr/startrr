// Back from Authrr. Anything that goes wrong lands on a page with a reason
// code (shared/utils/authrr-errors.ts), where the person can try again —
// never a bare error page in the middle of a sign-in. A popup's sign-in
// finishes on /auth/popup-done, which hands it to the page that opened it.
export default defineEventHandler(async (event) => {
  await assertRateLimit([{ key: `authrr-callback-ip:${clientIp(event)}`, limit: 60, windowSeconds: 600 }])
  let popup = false
  let next: string
  try {
    const result = await finishAuthrrLogin(event)
    popup = result.popup
    const user = await syncAuthrrUser(result.claims)
    await startSession(event, { id: user.id, email: user.email })
    next = result.redirect || '/'
  } catch (cause) {
    // ensureUser's 503 is the one error worth naming that isn't ours.
    const code = cause instanceof AuthrrLoginError
      ? cause.code
      : (cause as { statusCode?: number }).statusCode === 503 ? 'full' : 'failed'
    if (cause instanceof AuthrrLoginError) popup = cause.popup
    else console.error('[authrr] sign-in failed', cause)
    return sendRedirect(event, `${popup ? '/auth/popup-done' : '/login'}?${new URLSearchParams({ error: code })}`, 302)
  }
  return sendRedirect(event, popup ? `/auth/popup-done?${new URLSearchParams({ next })}` : next, 302)
})

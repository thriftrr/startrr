// "Sign in" when accounts live in Authrr: off to its authorize page.
// ?redirect= is where to land afterwards (same-origin paths only).
export default defineEventHandler(async (event) => {
  await assertRateLimit([{ key: `authrr-start-ip:${clientIp(event)}`, limit: 60, windowSeconds: 600 }])
  const redirect = safeRedirectPath(getQuery(event).redirect)
  return sendRedirect(event, await startAuthrrLogin(event, redirect.length <= 1024 ? redirect : ''), 302)
})

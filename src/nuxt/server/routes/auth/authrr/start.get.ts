// "Sign in" when accounts live in Authrr: off to its authorize page.
// ?redirect= is where to land afterwards (same-origin paths only); ?popup=1
// when /login opened this in a small window over the page.
export default defineEventHandler(async (event) => {
  await assertRateLimit([{ key: `authrr-start-ip:${clientIp(event)}`, limit: 60, windowSeconds: 600 }])
  const query = getQuery(event)
  const redirect = safeRedirectPath(query.redirect)
  const url = await startAuthrrLogin(event, redirect.length <= 1024 ? redirect : '', query.popup === '1')
  return sendRedirect(event, url, 302)
})

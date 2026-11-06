// "Sign in" when accounts live in Authrr: off to its authorize page.
// ?redirect= is where to land afterwards (same-origin paths only); ?popup=1
// when /login opened this in a small window over the page; ?theme= and
// ?scheme= the palette and look the Authrr window should match.
export default defineEventHandler(async (event) => {
  await assertRateLimit([{ key: `authrr-start-ip:${clientIp(event)}`, limit: 60, windowSeconds: 600 }])
  const query = getQuery(event)
  const redirect = safeRedirectPath(query.redirect)
  // The app's look for the Authrr window: Authrr checks it again, and
  // ignores a palette it doesn't have.
  const look = {
    ...(query.scheme === 'light' || query.scheme === 'dark' ? { scheme: query.scheme } : {}),
    ...(typeof query.theme === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(query.theme) ? { theme: query.theme } : {})
  }
  const url = await startAuthrrLogin(event, redirect.length <= 1024 ? redirect : '', query.popup === '1', look)
  return sendRedirect(event, url, 302)
})

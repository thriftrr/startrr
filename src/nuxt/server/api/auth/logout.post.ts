export default defineEventHandler(async (event) => {
  await endSession(event)
  // With Authrr, ending only this app's session would be undone at once:
  // /login sends people to Authrr, which is still signed in. So the page
  // carries on through Authrr's logout.
  return { ok: true, ...(authrrEnabled() ? { next: authrrLogoutUrl(event) } : {}) }
})

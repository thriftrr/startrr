// Refuses API writes whose Origin doesn't match the app. See utils/origin.ts
// for the rules; this just feeds it the request.
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const { appOrigin } = useRuntimeConfig()
  const allowed = isRequestAllowed({
    method: event.method,
    path: url.pathname,
    origin: getRequestHeader(event, 'origin'),
    fetchSite: getRequestHeader(event, 'sec-fetch-site'),
    hasCookie: Boolean(getRequestHeader(event, 'cookie')),
    // Pinned in production (NUXT_APP_ORIGIN); the request's own origin in dev.
    expectedOrigin: appOrigin || url.origin
  })
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-site request refused' })
  }
})

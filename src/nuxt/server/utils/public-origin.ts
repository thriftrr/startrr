import type { H3Event } from 'h3'

// The origin the outside world sees: what emailed links point at and what
// passkeys are bound to. Pinned by NUXT_APP_ORIGIN in production — deriving
// it from the request would let a spoofed Host header (behind a plain reverse
// proxy) mail out a live token pointing at an attacker's domain. Dev falls
// back to the request's own origin.
export function publicOrigin (event: H3Event): string {
  const { appOrigin } = useRuntimeConfig()
  if (!appOrigin && !import.meta.dev) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_APP_ORIGIN is not set' })
  }
  return (appOrigin || getRequestURL(event).origin).replace(/\/$/, '')
}

// Cross-site request forgery guard for API writes, as a pure function so it
// can be unit-tested without an H3 event.
//
// The session cookie is SameSite=Lax, which already stops cross-site POSTs
// from a normal form or fetch. This adds a second, independent check on the
// browser-controlled Origin / Sec-Fetch-Site headers, so a future cookie
// change or an odd browser can't silently open the door.

export interface OriginCheckInput {
  method: string
  path: string
  origin: string | null | undefined
  fetchSite: string | null | undefined
  hasCookie: boolean
  expectedOrigin: string
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isRequestAllowed (input: OriginCheckInput): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true
  if (!input.path.startsWith('/api/')) return true

  // A browser always sends Origin on cross-origin requests and on same-origin
  // POSTs; when it's there it has to match exactly.
  if (input.origin) return input.origin === input.expectedOrigin.replace(/\/$/, '')

  // No Origin. Modern browsers still say where the request came from.
  if (input.fetchSite === 'same-origin' || input.fetchSite === 'none') return true
  if (input.fetchSite) return false

  // Neither header: not a browser (curl, a script, a test). Without a cookie
  // there is nothing to forge; with one, refuse — a real browser would have
  // sent Origin.
  return !input.hasCookie
}

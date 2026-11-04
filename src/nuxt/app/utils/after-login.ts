import { APP_SLUG } from '#shared/app'

// Where to go after a magic link lands: the page that bounced the person to
// /login, remembered across the email round trip in sessionStorage. Only
// same-origin paths are honored, so the link can't be used to send someone
// off-site.
const KEY = `${APP_SLUG}:after-login`

// safeRedirectPath lives in shared/utils/redirect.ts (the server needs it
// too).

// Lands on a post-sign-in destination, whether it's a page or the
// /oauth/authorize request an app is waiting on.
export function goAfterLogin (path: string) {
  const target = path || '/'
  return navigateTo(target, { external: isServerPath(target), replace: true })
}

export function rememberAfterLogin (path: string) {
  try {
    if (path) sessionStorage.setItem(KEY, path)
    else sessionStorage.removeItem(KEY)
  } catch { /* fine — they land on the home page */ }
}

export function takeAfterLogin (): string {
  try {
    const path = safeRedirectPath(sessionStorage.getItem(KEY))
    sessionStorage.removeItem(KEY)
    return path
  } catch {
    return ''
  }
}

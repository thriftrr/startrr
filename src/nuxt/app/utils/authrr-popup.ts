import { APP_SLUG } from '#shared/app'

// Popup sign-in through Authrr.
//
// /login opens /auth/authrr/start?popup=1 in a small window; Authrr signs
// the person in there; the callback sets this app's session cookie and
// lands the window on /auth/popup-done, which announces it on a
// BroadcastChannel. Not postMessage: the security headers'
// Cross-Origin-Opener-Policy cuts the window off from its opener as soon
// as it visits Authrr. A channel reaches every tab of this app instead —
// which also means a sign-in finished in another tab (an emailed link)
// signs in the one waiting.

export type AuthrrPopupMessage
  = | { type: 'signed-in', next: string }
    | { type: 'error', code: string }

function channel (): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`${APP_SLUG}:authrr`)
}

export function announceAuthrrResult (message: AuthrrPopupMessage) {
  const ch = channel()
  ch?.postMessage(message)
  ch?.close()
}

// Opens the sign-in window and calls back once with how it went. Returns
// false when the window couldn't open (a popup blocker; some in-app
// browsers), and the caller falls back to a plain redirect.
export function openAuthrrPopup (startUrl: string, done: (message: AuthrrPopupMessage) => void): { opened: boolean, stop: () => void } {
  const ch = channel()
  const width = 480
  const height = 680
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 3))
  const win = ch
    ? window.open(startUrl, `${APP_SLUG}-authrr`, `popup,width=${width},height=${height},left=${left},top=${top}`)
    : null
  if (!win || !ch) {
    ch?.close()
    return { opened: false, stop: () => {} }
  }
  const stop = () => ch.close()
  ch.onmessage = (e: MessageEvent<AuthrrPopupMessage>) => {
    if (e.data?.type !== 'signed-in' && e.data?.type !== 'error') return
    stop()
    done(e.data)
  }
  return { opened: true, stop }
}

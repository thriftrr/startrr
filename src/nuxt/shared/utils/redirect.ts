// Same-origin paths only, so a crafted ?redirect= can't send someone
// off-site. Shared: the sign-in pages read it, and the magic-link sender
// bakes it into the emailed link.
//
// Browsers drop tabs and newlines from a URL before reading it, so
// "/<tab>/evil.example" is "//evil.example" — another site. Any control
// character or space is refused outright, and what's left has to resolve
// to this origin.
const PROBE = 'http://same.invalid'

export function safeRedirectPath (value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return ''
  // eslint-disable-next-line no-control-regex -- refusing them is the point
  if (value.includes('\\') || /[\u0000-\u0020\u007F-\u009F\u2028\u2029]/.test(value)) return ''
  try {
    return new URL(value, PROBE).origin === PROBE ? value : ''
  } catch {
    return ''
  }
}

// /oauth/* are server routes, not pages: the client router can't reach
// them, so they need a full navigation.
export function isServerPath (path: string): boolean {
  return path.startsWith('/oauth/')
}

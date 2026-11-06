// Same-origin paths only, so a crafted ?redirect= can't send someone
// off-site. Shared: the sign-in pages read it, and the magic-link sender
// bakes it into the emailed link.
export function safeRedirectPath (value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : ''
}

// /oauth/* are server routes, not pages: the client router can't reach
// them, so they need a full navigation.
export function isServerPath (path: string): boolean {
  return path.startsWith('/oauth/')
}

// Puts the request's CSP nonce (server/middleware/security.ts) on every
// script Nuxt renders: the entry module, the runtime-config inline script,
// the hydration payload, and anything added through useHead. Modulepreload
// links get it too so the browser's preloads pass the same check.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:html', (html, { event }) => {
    const nonce = event.context.cspNonce
    if (typeof nonce !== 'string' || !nonce) return
    const stamp = (chunk: string) => chunk
      .replace(/<script(?=[\s>])(?![^>]*\snonce=)/g, `<script nonce="${nonce}"`)
      .replace(/<link(?=\s)(?=[^>]*rel="modulepreload")(?![^>]*\snonce=)/g, `<link nonce="${nonce}"`)
    for (const key of ['head', 'bodyPrepend', 'body', 'bodyAppend'] as const) {
      html[key] = html[key].map(stamp)
    }
  })
})

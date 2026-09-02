// Reject oversized API bodies before any handler parses them. The avatar
// upload enforces its own (1MB) limit; everything else is JSON that has no
// business exceeding a couple of megabytes.
const LIMIT = 2 * 1024 * 1024
const UPLOAD_ROUTES = ['/api/account/avatar']

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return
  if (UPLOAD_ROUTES.some(route => path === route || path.startsWith(`${route}/`))) return
  const length = Number(getHeader(event, 'content-length') ?? 0)
  if (length > LIMIT) {
    throw createError({ statusCode: 413, statusMessage: 'Request body too large' })
  }
})

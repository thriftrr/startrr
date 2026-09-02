// Profile picture upload. Stored via NuxtHub Blob — Cloudflare R2 on a
// deployed app, the local fs driver in dev — under avatars/<userId>, and
// served back through avatar.get.ts.
const MAX_BYTES = 1024 * 1024 // 1MB

export default defineEventHandler(async (event) => {
  const session = await requireUser(event)

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file' && part.filename)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'No image was uploaded' })
  }

  // Checked before anything touches storage. Done here rather than leaning on
  // ensureBlob alone so the message can name the actual size.
  if (file.data.length > MAX_BYTES) {
    const mb = (file.data.length / 1024 / 1024).toFixed(1)
    throw createError({
      statusCode: 413,
      statusMessage: `That image is ${mb}MB — the limit is 1MB. Try a smaller one.`
    })
  }

  const type = file.type?.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream'
  const upload = new Blob([new Uint8Array(file.data)], { type })

  // Raster formats only: an SVG would be served back same-origin with its
  // scripts intact.
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  try {
    if (!allowed.includes(type)) throw new Error('type')
    ensureBlob(upload, { maxSize: '1MB', types: ['image'] })
  } catch {
    throw createError({ statusCode: 415, statusMessage: 'Use a PNG, JPEG, WebP, or GIF image' })
  }

  // One object per user, overwritten on replace — no orphans to sweep up.
  await blob.put(`avatars/${session.id}`, upload, { contentType: type, addRandomSuffix: false })

  // The stored key doubles as the cache-buster, so it changes on every upload.
  const stamped = `avatars/${session.id}?t=${Date.now()}`
  await setUserAvatarKey(session.id, stamped)
  return { ok: true, avatarUrl: `/api/account/avatar?v=${encodeURIComponent(stamped)}` }
})

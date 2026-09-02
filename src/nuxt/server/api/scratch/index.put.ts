import type { ScratchNote } from '#shared/types/scratch'

const MAX_TEXT = 10_000

// Example feature, write side: validate, rate-limit, store under the user's
// own key. Nothing here can touch another user's note.
export default defineEventHandler(async (event): Promise<ScratchNote> => {
  const user = await requireUser(event)
  await assertRateLimit([{ key: `scratch-user:${user.id}`, limit: 60, windowSeconds: 3_600 }])

  const body = await readBody<{ text?: unknown }>(event)
  const text = body?.text
  if (typeof text !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'text must be a string' })
  }
  if (text.length > MAX_TEXT) {
    throw createError({ statusCode: 400, statusMessage: `Keep it under ${MAX_TEXT.toLocaleString()} characters` })
  }

  const note: ScratchNote = { text, updatedAt: new Date().toISOString() }
  await kv.set(`scratch:${user.id}`, note)
  return note
})

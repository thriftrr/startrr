import { deleteFeedback } from '../utils/feedback-db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id' })
  const removed = await deleteFeedback(id)
  if (!removed) throw createError({ statusCode: 404, statusMessage: 'Feedback not found' })
  return { ok: true }
})

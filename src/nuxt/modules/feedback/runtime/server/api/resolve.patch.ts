import { setFeedbackResolved } from '../utils/feedback-db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id' })
  const body = await readBody<{ resolved?: boolean }>(event)
  if (typeof body?.resolved !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'resolved must be true or false' })
  }
  const record = await setFeedbackResolved(id, body.resolved)
  if (!record) throw createError({ statusCode: 404, statusMessage: 'Feedback not found' })
  return { feedback: record }
})

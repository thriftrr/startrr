import { listFeedback } from '../utils/feedback-db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { feedback: await listFeedback() }
})

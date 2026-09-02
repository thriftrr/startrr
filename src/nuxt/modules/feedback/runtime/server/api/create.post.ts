import { insertFeedback, validateFeedback } from '../utils/feedback-db'
import { feedbackEmail } from '../utils/feedback-email'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  // Each submission emails the admins, so cap it like any other send.
  await assertRateLimit([
    { key: `feedback-user:${user.id}`, limit: 5, windowSeconds: 3_600 },
    { key: `feedback-user-day:${user.id}`, limit: 20, windowSeconds: 86_400 },
    { key: `feedback-ip:${clientIp(event)}`, limit: 30, windowSeconds: 3_600 }
  ])

  const body = await readBody(event)
  const clean = validateFeedback(body)

  const record = await insertFeedback({
    userId: user.id,
    email: user.email,
    name: clean.name,
    body: clean.body,
    page: clean.page,
    userAgent: getRequestHeader(event, 'user-agent') ?? ''
  })

  // Notify every admin. A broken transport must not eat the feedback itself —
  // it's already in the database; the inbox page shows it regardless.
  const message = feedbackEmail({
    name: record.name,
    email: record.email,
    body: record.body,
    page: record.page,
    receivedAt: new Date(record.createdAt),
    inboxUrl: `${(useRuntimeConfig().appOrigin || getRequestURL(event).origin).replace(/\/$/, '')}/admin/feedback`
  })
  await Promise.all(adminEmails().map(to =>
    sendEmail(event, { to, ...message }).catch((err: unknown) => {
      console.error('[feedback] notification email failed:', (err as Error)?.message ?? err)
    })
  ))

  return { ok: true, id: record.id }
})

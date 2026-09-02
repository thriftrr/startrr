import { desc, eq } from 'drizzle-orm'

export interface FeedbackRecord {
  id: string
  userId: string
  email: string
  name: string
  body: string
  page: string
  userAgent: string
  resolvedAt: string | null
  createdAt: string
}

export const FEEDBACK_MAX_NAME = 80
export const FEEDBACK_MAX_BODY = 20_000
const MAX_PAGE = 200
const MAX_UA = 300
const LIST_CAP = 500

export interface NewFeedback {
  userId: string
  email: string
  name: string
  body: string
  page: string
  userAgent: string
}

function cleanText (value: unknown, label: string, max: number, required: boolean): string {
  if (value == null) value = ''
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: `${label} must be text` })
  }
  const trimmed = value.trim()
  if (required && !trimmed) {
    throw createError({ statusCode: 400, statusMessage: `${label} is required` })
  }
  if (trimmed.length > max) {
    throw createError({ statusCode: 400, statusMessage: `${label} is too long (max ${max} characters)` })
  }
  return trimmed
}

// Bounds only — the body is Markdown and is stored verbatim. It is untrusted
// forever: rendering goes through markdown-it with html:false, nothing else.
export function validateFeedback (raw: unknown): { name: string, body: string, page: string } {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    name: cleanText(input.name, 'Name', FEEDBACK_MAX_NAME, true),
    body: cleanText(input.body, 'Feedback', FEEDBACK_MAX_BODY, true),
    page: cleanText(input.page, 'Page', MAX_PAGE, false)
  }
}

export async function insertFeedback (input: NewFeedback): Promise<FeedbackRecord> {
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await db.insert(schema.feedback).values({
    id,
    userId: input.userId,
    email: input.email,
    name: input.name,
    body: input.body,
    page: input.page,
    userAgent: input.userAgent.slice(0, MAX_UA),
    createdAt
  }).run()
  return { id, ...input, userAgent: input.userAgent.slice(0, MAX_UA), resolvedAt: null, createdAt }
}

export async function listFeedback (): Promise<FeedbackRecord[]> {
  return await db.select().from(schema.feedback)
    .orderBy(desc(schema.feedback.createdAt))
    .limit(LIST_CAP)
    .all()
}

export async function setFeedbackResolved (id: string, resolved: boolean): Promise<FeedbackRecord | null> {
  await db.update(schema.feedback)
    .set({ resolvedAt: resolved ? new Date().toISOString() : null })
    .where(eq(schema.feedback.id, id))
    .run()
  return await db.select().from(schema.feedback).where(eq(schema.feedback.id, id)).get() ?? null
}

export async function deleteFeedback (id: string): Promise<boolean> {
  const existing = await db.select({ id: schema.feedback.id }).from(schema.feedback).where(eq(schema.feedback.id, id)).get()
  if (!existing) return false
  await db.delete(schema.feedback).where(eq(schema.feedback.id, id)).run()
  return true
}

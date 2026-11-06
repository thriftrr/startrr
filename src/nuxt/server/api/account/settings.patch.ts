import { APP_SLUG } from '#shared/app'
import { isBuiltinSetting } from '#shared/types/settings'

// One setting, from the browser: a built-in (not the photo — that's an
// upload) or one of this app's own (`<app>.something`). Server code can set
// anything with setSetting; the browser only these.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await assertRateLimit([{ key: `settings:${user.id}`, limit: 120, windowSeconds: 600 }])
  const body = await readBody<{ key?: unknown, value?: unknown, scope?: unknown }>(event)
  const key = typeof body?.key === 'string' ? body.key : ''
  if (key === 'photo' || !(isBuiltinSetting(key) || key.startsWith(`${APP_SLUG}.`))) {
    throw createError({ statusCode: 400, statusMessage: 'Not a setting this app can change' })
  }
  const scope = body?.scope === 'app' ? 'app' : 'global'
  return { settings: await setSetting(event, user.id, key, body?.value ?? null, scope) }
})

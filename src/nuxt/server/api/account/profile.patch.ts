import { isPaletteId } from '#shared/types/palette'

const MAX_NAME = 60

// Trims to null so an emptied field clears rather than storing "".
function cleanName (value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Names must be text' })
  }
  const trimmed = value.trim()
  if (trimmed.length > MAX_NAME) {
    throw createError({ statusCode: 400, statusMessage: `Keep names under ${MAX_NAME} characters` })
  }
  return trimmed || null
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ firstName?: unknown, lastName?: unknown, palette?: unknown, dismissOnboarding?: unknown, scope?: unknown }>(event)

  const patch: ProfilePatch = {}

  // Through Authrr, name and palette are settings there (server/utils/
  // settings.ts): for every app, or with scope 'app' just this one.
  if (authrrEnabled()) {
    const scope = body?.scope === 'app' ? 'app' : 'global'
    if (body?.firstName !== undefined) await setSetting(event, user.id, 'name.first', cleanName(body.firstName), scope)
    if (body?.lastName !== undefined) await setSetting(event, user.id, 'name.last', cleanName(body.lastName), scope)
    if (body?.palette !== undefined) {
      if (!isPaletteId(body.palette)) throw createError({ statusCode: 400, statusMessage: 'Unknown colour palette' })
      await setSetting(event, user.id, 'palette', body.palette, scope)
    }
    if (body?.dismissOnboarding === true) await updateUserProfile(user.id, { onboardingDismissedAt: new Date().toISOString() })
    return { ok: true }
  }

  const first = cleanName(body?.firstName)
  if (first !== undefined) patch.firstName = first
  const last = cleanName(body?.lastName)
  if (last !== undefined) patch.lastName = last

  if (body?.palette !== undefined) {
    if (!isPaletteId(body.palette)) {
      throw createError({ statusCode: 400, statusMessage: 'Unknown colour palette' })
    }
    patch.palette = body.palette
  }

  if (body?.dismissOnboarding === true) patch.onboardingDismissedAt = new Date().toISOString()

  await updateUserProfile(user.id, patch)
  return { ok: true }
})

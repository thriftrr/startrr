import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { SettingScope, SettingsMap } from '#shared/types/settings'
import { cleanSettingValue, resolveSettings } from '#shared/types/settings'
import { isPaletteId } from '#shared/types/palette'

// Settings that follow a person (shared/types/settings.ts): name, photo,
// palette, notification emails, and any of this app's own.
//
//   const buyIn = await getSetting(event, user.id, 'pokrr.default_buy_in', 200)
//   await setSetting(event, user.id, 'pokrr.default_buy_in', 500, 'app')
//
// Signed in through Authrr, they live there: a global value every thriftrr
// app shares and, per app, an override. `scope: 'global'` (the default) is
// "everywhere" and drops this app's override; 'app' is this app only.
// Running its own accounts, there's only this app: scope makes no
// difference, and the values live in `users` and `user_settings`.
//
// The profile settings are also copied onto `users` (names, palette, photo
// URL), so pages render them without asking Authrr; they're refreshed at
// every sign-in, every hourly session check and every change made here.

export type { SettingsMap }

function parse (value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

async function localSettings (userId: string): Promise<SettingsMap> {
  const user = await getUserById(userId)
  const rows = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)).all()
  const values: Record<string, unknown> = {
    'name.first': user?.firstName ?? null,
    'name.last': user?.lastName ?? null,
    'palette': user?.palette ?? null,
    'photo': user?.avatarKey ? `/api/account/avatar?v=${encodeURIComponent(user.avatarKey)}` : null
  }
  for (const row of rows) values[row.key] = parse(row.value)
  // One app, so everything set is this app's.
  const map = resolveSettings({}, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)))
  return map
}

// Copies what Authrr says onto the local row (see above).
async function cacheProfile (userId: string, map: SettingsMap) {
  const text = (key: string) => {
    const v = map[key]?.value
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const palette = text('palette')
  await applyAuthrrProfile(userId, {
    firstName: text('name.first'),
    lastName: text('name.last'),
    pictureUrl: text('photo'),
    palette: isPaletteId(palette) ? palette : null
  })
}

async function authrrSub (userId: string): Promise<string> {
  const user = await getUserById(userId)
  if (!user?.authrrSub) throw createError({ statusCode: 409, statusMessage: 'Sign in again to manage your settings' })
  return user.authrrSub
}

export async function settingsOf (event: H3Event, userId: string): Promise<SettingsMap> {
  if (!authrrEnabled()) return await localSettings(userId)
  const { settings } = await authrrApi<{ settings: SettingsMap }>(event, '/oauth/settings/read', { json: { sub: await authrrSub(userId) } })
  return settings
}

export async function getSetting<T> (event: H3Event, userId: string, key: string, fallback: T): Promise<T> {
  const value = (await settingsOf(event, userId))[key]?.value
  return value === null || value === undefined ? fallback : value as T
}

// Notification emails are on unless someone turned them off.
export async function wantsNotificationEmails (event: H3Event, userId: string): Promise<boolean> {
  return await getSetting(event, userId, 'email.notifications', true) !== false
}

// The same, by address: an address with no account here gets the email. A
// lookup that fails sends it too — a missed notification is worse than an
// unwanted one.
export async function wantsNotificationEmailsAt (event: H3Event, email: string): Promise<boolean> {
  const user = await getUserByEmail(email.trim().toLowerCase())
  if (!user) return true
  try {
    return await wantsNotificationEmails(event, user.id)
  } catch {
    return true
  }
}

export async function setSetting (event: H3Event, userId: string, key: string, value: unknown, scope: SettingScope = 'global'): Promise<SettingsMap> {
  const clean = cleanSettingValue(key, value)
  if (!clean.ok) throw createError({ statusCode: 400, statusMessage: clean.reason })

  if (authrrEnabled()) {
    const { settings } = await authrrApi<{ settings: SettingsMap }>(event, '/oauth/settings/write', {
      json: { sub: await authrrSub(userId), key, value: clean.value, scope }
    })
    await cacheProfile(userId, settings)
    return settings
  }

  if (key === 'palette' && clean.value !== null && !isPaletteId(clean.value)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown colour palette' })
  }
  if (key === 'name.first') await updateUserProfile(userId, { firstName: clean.value as string | null })
  else if (key === 'name.last') await updateUserProfile(userId, { lastName: clean.value as string | null })
  else if (key === 'palette') await updateUserProfile(userId, { palette: clean.value as string | null })
  else if (clean.value === null) {
    await db.delete(schema.userSettings).where(and(eq(schema.userSettings.userId, userId), eq(schema.userSettings.key, key))).run()
  } else {
    const json = JSON.stringify(clean.value)
    await db.insert(schema.userSettings).values({ userId, key, value: json })
      .onConflictDoUpdate({ target: [schema.userSettings.userId, schema.userSettings.key], set: { value: json, updatedAt: new Date().toISOString() } })
      .run()
  }
  return await localSettings(userId)
}

// Photos through Authrr (running its own accounts, the app's avatar routes
// store them itself).
export async function setAuthrrPhoto (event: H3Event, userId: string, image: { data: Uint8Array, type: string }, scope: SettingScope): Promise<SettingsMap> {
  const query = new URLSearchParams({ sub: await authrrSub(userId), scope })
  const { settings } = await authrrApi<{ settings: SettingsMap }>(event, `/oauth/settings/photo?${query}`, {
    body: new Blob([image.data.slice()], { type: image.type }),
    contentType: image.type
  })
  await cacheProfile(userId, settings)
  return settings
}

export async function removeAuthrrPhoto (event: H3Event, userId: string, scope: SettingScope): Promise<SettingsMap> {
  const { settings } = await authrrApi<{ settings: SettingsMap }>(event, '/oauth/settings/photo-remove', {
    json: { sub: await authrrSub(userId), scope }
  })
  await cacheProfile(userId, settings)
  return settings
}

// Settings that follow a person across the thriftrr apps.
//
// Every setting has a global value and, per app, an optional override; an
// app sees its override if there is one, else the global value. A handful
// are built in — every app knows what they mean — and an app may keep
// settings of its own under any other key (`pokrr.default_buy_in`).

export type SettingScope = 'global' | 'app'

export interface SettingView {
  // What this app should use.
  value: unknown
  // Where that came from: this app's override, the global value, or
  // nothing set at all.
  from: 'app' | 'global' | null
  global: unknown
  override: unknown
}

export type SettingsMap = Record<string, SettingView>

export const SETTING_KEY_RE = /^[a-z][a-z0-9_-]{0,31}(\.[a-z0-9_-]{1,31}){0,3}$/
export const MAX_SETTING_BYTES = 4096
export const MAX_SETTINGS_PER_SCOPE = 100
const MAX_NAME = 60

export const BUILTIN_SETTINGS = ['name.first', 'name.last', 'palette', 'photo', 'email.notifications'] as const
export type BuiltinSetting = typeof BUILTIN_SETTINGS[number]

export const SETTING_LABELS: Record<string, string> = {
  'name.first': 'First name',
  'name.last': 'Last name',
  'palette': 'Colour palette',
  'photo': 'Photo',
  'email.notifications': 'Notification emails'
}

export function isBuiltinSetting (key: string): key is BuiltinSetting {
  return (BUILTIN_SETTINGS as readonly string[]).includes(key)
}

// The value to store, or a reason it can't be. `null` always means "clear
// it". The photo is never written as a value: it has its own upload.
export function cleanSettingValue (key: string, value: unknown): { ok: true, value: unknown } | { ok: false, reason: string } {
  if (!SETTING_KEY_RE.test(key)) return { ok: false, reason: 'Setting names are lowercase words joined by dots, like pokrr.buy_in' }
  // 'constructor' and friends would read as Object.prototype's own.
  if (key in Object.prototype) return { ok: false, reason: 'That name is taken' }
  if (key === 'photo') return { ok: false, reason: 'Upload a photo instead' }
  if (value === null) return { ok: true, value: null }
  switch (key) {
    case 'name.first':
    case 'name.last': {
      if (typeof value !== 'string') return { ok: false, reason: 'A name is text' }
      const trimmed = value.trim()
      if (trimmed.length > MAX_NAME) return { ok: false, reason: `Keep names under ${MAX_NAME} characters` }
      return { ok: true, value: trimmed || null }
    }
    case 'palette':
      // Each app has its own palettes; one it doesn't know falls back to its
      // default, so the id only has to be a sensible slug.
      return typeof value === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(value)
        ? { ok: true, value }
        : { ok: false, reason: 'Unknown colour palette' }
    case 'email.notifications':
      return typeof value === 'boolean' ? { ok: true, value } : { ok: false, reason: 'Notification emails are on or off' }
  }
  let json: string
  try {
    json = JSON.stringify(value)
  } catch {
    return { ok: false, reason: 'Settings are JSON values' }
  }
  if (json === undefined) return { ok: false, reason: 'Settings are JSON values' }
  if (new TextEncoder().encode(json).length > MAX_SETTING_BYTES) return { ok: false, reason: `Keep a setting under ${MAX_SETTING_BYTES / 1024}KB` }
  return { ok: true, value }
}

// Who may set a key for every app: the built-ins, any app; otherwise only
// the app it's named for (`pokrr.` keys are Pokrr's), so one app can't
// change — or crowd out — another's.
export function mayWriteGlobal (key: string, appId: string): boolean {
  return isBuiltinSetting(key) || key.startsWith(`${appId}.`)
}

// Lays a person's global values and one app's overrides out as what that
// app sees. `undefined` means "not set" on either side.
export function resolveSettings (global: Record<string, unknown>, overrides: Record<string, unknown>): SettingsMap {
  const out: SettingsMap = {}
  const keys = new Set([...BUILTIN_SETTINGS, ...Object.keys(global), ...Object.keys(overrides)])
  for (const key of keys) {
    const g = Object.hasOwn(global, key) ? global[key] ?? null : null
    const o = Object.hasOwn(overrides, key) ? overrides[key] : undefined
    out[key] = o !== undefined
      ? { value: o, from: 'app', global: g, override: o }
      : { value: g, from: g === null ? null : 'global', global: g, override: null }
  }
  return out
}

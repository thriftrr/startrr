import { describe, expect, it } from 'vitest'
import { cleanSettingValue, resolveSettings } from '../../shared/types/settings'

describe('layered settings', () => {
  it('uses the app override, else the global value, else nothing', () => {
    const s = resolveSettings(
      { 'name.first': 'Jon', 'palette': 'teal', 'pokrr.buy_in': 200 },
      { 'name.first': 'Tubs', 'pokrr.buy_in': 500 }
    )
    expect(s['name.first']).toEqual({ value: 'Tubs', from: 'app', global: 'Jon', override: 'Tubs' })
    expect(s.palette).toEqual({ value: 'teal', from: 'global', global: 'teal', override: null })
    expect(s['pokrr.buy_in']?.value).toBe(500)
    // Built-ins are always listed, set or not.
    expect(s['email.notifications']).toEqual({ value: null, from: null, global: null, override: null })
    expect(s.photo?.from).toBeNull()
  })

  it('treats an override of false as an override', () => {
    const s = resolveSettings({ 'email.notifications': true }, { 'email.notifications': false })
    expect(s['email.notifications']?.value).toBe(false)
    expect(s['email.notifications']?.from).toBe('app')
  })
})

describe('setting values', () => {
  it('checks the built-ins', () => {
    expect(cleanSettingValue('name.first', '  Jon ')).toEqual({ ok: true, value: 'Jon' })
    expect(cleanSettingValue('name.first', '   ')).toEqual({ ok: true, value: null })
    expect(cleanSettingValue('name.first', 'x'.repeat(61)).ok).toBe(false)
    expect(cleanSettingValue('palette', 'teal').ok).toBe(true)
    expect(cleanSettingValue('palette', 'Teal!').ok).toBe(false)
    expect(cleanSettingValue('email.notifications', 'yes').ok).toBe(false)
    expect(cleanSettingValue('photo', 'https://x').ok).toBe(false)
  })

  it('takes any JSON for an app key, within bounds', () => {
    expect(cleanSettingValue('pokrr.default_buy_in', { chips: 500 }).ok).toBe(true)
    expect(cleanSettingValue('pokrr.notes', 'x'.repeat(5000)).ok).toBe(false)
    expect(cleanSettingValue('Bad Key', 1).ok).toBe(false)
    expect(cleanSettingValue('a.b.c.d.e', 1).ok).toBe(false)
    expect(cleanSettingValue('pokrr.x', null)).toEqual({ ok: true, value: null })
  })
})

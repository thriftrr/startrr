import { describe, expect, it } from 'vitest'
import { DEFAULT_PALETTE, PALETTES, PALETTE_IDS, isPaletteId } from '../../shared/types/palette'

describe('palettes', () => {
  it('have unique ids and include the default', () => {
    expect(new Set(PALETTE_IDS).size).toBe(PALETTES.length)
    expect(PALETTE_IDS).toContain(DEFAULT_PALETTE)
  })

  it('validate ids strictly', () => {
    expect(isPaletteId('ocean')).toBe(true)
    expect(isPaletteId('Ocean')).toBe(false)
    expect(isPaletteId('')).toBe(false)
    expect(isPaletteId(null)).toBe(false)
    expect(isPaletteId({ toString: () => 'ocean' })).toBe(false)
  })

  it('carry hex swatch colours', () => {
    for (const p of PALETTES) {
      for (const key of ['sidebar', 'accent', 'ground'] as const) {
        expect(p[key]).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })
})

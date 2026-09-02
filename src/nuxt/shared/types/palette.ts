// Colour palettes — the accent family, the sidebar ground, and the badge
// tints, re-tinted as a set. Token overrides live in design.css under
// html[data-palette="…"]; this list is the single source of ids for the
// account picker, the server validation, and the swatch previews.

export interface PaletteDef {
  id: string
  name: string
  // swatch preview colours (also the palette's --teal-deep / --teal / --bg-app)
  sidebar: string
  accent: string
  ground: string
}

export const DEFAULT_PALETTE = 'teal'

export const PALETTES: PaletteDef[] = [
  { id: 'teal', name: 'Teal', sidebar: '#0e7c73', accent: '#12968b', ground: '#faf6ef' },
  { id: 'ocean', name: 'Ocean', sidebar: '#1f5fb8', accent: '#2f6fd6', ground: '#f7f7f1' },
  { id: 'forest', name: 'Forest', sidebar: '#2e7340', accent: '#3a8f4a', ground: '#f9f7ee' },
  { id: 'plum', name: 'Plum', sidebar: '#6f3f8f', accent: '#8a4bb0', ground: '#faf5f2' },
  { id: 'ember', name: 'Ember', sidebar: '#a8452a', accent: '#c6532b', ground: '#fbf5ec' },
  { id: 'slate', name: 'Slate', sidebar: '#46546b', accent: '#5b6b83', ground: '#f6f5f1' },
  { id: 'rose', name: 'Rose', sidebar: '#a03a5b', accent: '#c2456a', ground: '#fbf5f1' }
]

export const PALETTE_IDS = PALETTES.map(p => p.id)

export const isPaletteId = (value: unknown): value is string =>
  typeof value === 'string' && PALETTE_IDS.includes(value)
